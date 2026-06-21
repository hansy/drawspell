type Mode = "probe" | "repair";

export {};

type CloudflareListResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
  result_info?: {
    cursor?: string;
    cursors?: { after?: string };
    after?: string;
  };
};

type DurableObjectNamespace = {
  id?: string;
  name?: string;
  class?: string;
  class_name?: string;
  script?: string;
  script_name?: string;
};

type DurableObjectListEntry = {
  id: string;
  hasStoredData?: boolean;
};

type RoomAdminProbeResult = {
  roomId: string;
  classification:
    | "active"
    | "scheduled-empty"
    | "legacy-empty-candidate"
    | "empty";
  activePlayerConnections: number;
  activeSpectatorConnections: number;
  pendingPlayerConnections: number;
  emptyRoomStartedAt: number | null;
  alarm: number | null;
  storage: {
    totalKeys: number;
    keyPrefixes: Record<string, number>;
    hasRoomTokens: boolean;
    hasYDoc: boolean;
    hasSnapshot: boolean;
    hasHiddenState: boolean;
    hasGameLog: boolean;
    hasIntentLog: boolean;
  };
};

type RoomAdminRepairResult = {
  repaired: boolean;
  reason: string;
  before: RoomAdminProbeResult;
  after: RoomAdminProbeResult;
};

type RoomAdminEntry = {
  objectId: string;
  hasStoredData: boolean;
  probe?: RoomAdminProbeResult;
  repair?: RoomAdminRepairResult | { dryRun: true; reason: string };
  error?: string;
};

const readArg = (name: string) => {
  const idx = process.argv.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  if (!raw || raw.startsWith("--")) return null;
  return raw;
};

const hasArg = (name: string) => process.argv.includes(`--${name}`);

const readNumber = (name: string, fallback: number) => {
  const raw = readArg(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const envName = readArg("env") ?? "production";
const mode = (readArg("mode") ?? "probe") as Mode;
const serverUrl =
  readArg("server") ??
  (envName === "production"
    ? "https://ws.drawspell.space"
    : "https://staging.ws.drawspell.space");
const namespaceId =
  readArg("namespaceId") ??
  process.env.DURABLE_OBJECT_NAMESPACE_ID ??
  process.env.CF_DURABLE_OBJECT_NAMESPACE_ID ??
  null;
const namespaceName = readArg("namespaceName");
const scriptName =
  readArg("script") ??
  (envName === "production"
    ? "drawspell-server-production"
    : envName === "staging"
      ? "drawspell-server-staging"
      : "drawspell-server");
const limit = readNumber("limit", Number.POSITIVE_INFINITY);
const concurrency = Math.max(1, readNumber("concurrency", 5));
const outputPath = readArg("output");
const apply = hasArg("apply");
const includeEmptyObjects = hasArg("includeEmptyObjects");

const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
const apiToken =
  process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
const adminToken = process.env.ROOM_ADMIN_TOKEN;

if (mode !== "probe" && mode !== "repair") {
  throw new Error("--mode must be probe or repair");
}
if (!accountId) {
  throw new Error("Set CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID");
}
if (!apiToken) {
  throw new Error("Set CLOUDFLARE_API_TOKEN or CF_API_TOKEN");
}
if (!adminToken) {
  throw new Error("Set ROOM_ADMIN_TOKEN");
}

const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

const cloudflareFetch = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json()) as CloudflareListResponse<T>;
  if (!response.ok || !payload.success) {
    const message =
      payload.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
      response.statusText;
    throw new Error(`Cloudflare API request failed: ${message}`);
  }
  return payload.result;
};

const cloudflareFetchPage = async <T>(
  path: string,
): Promise<CloudflareListResponse<T>> => {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json()) as CloudflareListResponse<T>;
  if (!response.ok || !payload.success) {
    const message =
      payload.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
      response.statusText;
    throw new Error(`Cloudflare API request failed: ${message}`);
  }
  return payload;
};

const resolveNamespaceId = async () => {
  if (namespaceId) return namespaceId;

  const namespaces = await cloudflareFetch<DurableObjectNamespace[]>(
    "/workers/durable_objects/namespaces",
  );
  const matches = namespaces.filter((namespace) => {
    const namespaceClass = namespace.class ?? namespace.class_name;
    const namespaceScript = namespace.script ?? namespace.script_name;
    if (namespaceName && namespace.name !== namespaceName) return false;
    if (namespaceClass !== "Room") return false;
    if (scriptName && namespaceScript && namespaceScript !== scriptName) {
      return false;
    }
    return true;
  });
  if (matches.length === 1 && matches[0]?.id) {
    return matches[0].id;
  }
  if (matches.length === 0) {
    throw new Error(
      "Could not find the Room Durable Object namespace. Pass --namespaceId or set DURABLE_OBJECT_NAMESPACE_ID.",
    );
  }
  throw new Error(
    `Found ${matches.length} Room namespaces. Pass --namespaceId to select one.`,
  );
};

const nextCursor = (response: CloudflareListResponse<unknown>) =>
  response.result_info?.cursor ??
  response.result_info?.cursors?.after ??
  response.result_info?.after ??
  null;

const listDurableObjects = async (resolvedNamespaceId: string) => {
  const objects: DurableObjectListEntry[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ per_page: "1000" });
    if (cursor) params.set("cursor", cursor);
    const path = `/workers/durable_objects/namespaces/${resolvedNamespaceId}/objects?${params}`;
    const page = await cloudflareFetchPage<DurableObjectListEntry[]>(path);
    for (const object of page.result) {
      if (!includeEmptyObjects && object.hasStoredData === false) continue;
      objects.push(object);
      if (objects.length >= limit) return objects;
    }
    cursor = nextCursor(page);
  } while (cursor);
  return objects;
};

const callRoomAdmin = async <T>(
  path: "/admin/rooms/probe" | "/admin/rooms/repair",
  objectId: string,
): Promise<T> => {
  const response = await fetch(new URL(path, serverUrl).toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ objectId }),
  });
  if (!response.ok) {
    throw new Error(
      `${path} failed for ${objectId}: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
};

const mapConcurrent = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
) => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
};

const summarize = (entries: RoomAdminEntry[]) => {
  const classifications = new Map<string, number>();
  let repaired = 0;
  let errors = 0;
  for (const entry of entries) {
    if (!entry.probe) {
      errors += 1;
      continue;
    }
    const classification = entry.probe.classification;
    classifications.set(classification, (classifications.get(classification) ?? 0) + 1);
    if (entry.repair && "repaired" in entry.repair && entry.repair.repaired) {
      repaired += 1;
    }
  }
  return {
    mode,
    env: envName,
    serverUrl,
    total: entries.length,
    classifications: Object.fromEntries(classifications.entries()),
    repaired,
    errors,
    dryRun: mode === "repair" && !apply,
  };
};

const main = async () => {
  const resolvedNamespaceId = await resolveNamespaceId();
  console.log(`Using Durable Object namespace ${resolvedNamespaceId}`);
  const objects = await listDurableObjects(resolvedNamespaceId);
  console.log(`Found ${objects.length} Durable Object instance(s) to probe`);

  const entries = await mapConcurrent(objects, async (object, index) => {
    const entry: RoomAdminEntry = {
      objectId: object.id,
      hasStoredData: object.hasStoredData !== false,
    };
    try {
      const probe = await callRoomAdmin<RoomAdminProbeResult>(
        "/admin/rooms/probe",
        object.id,
      );
      entry.probe = probe;
      if (
        mode === "repair" &&
        probe.classification === "legacy-empty-candidate"
      ) {
        entry.repair = apply
          ? await callRoomAdmin<RoomAdminRepairResult>(
              "/admin/rooms/repair",
              object.id,
            )
          : { dryRun: true, reason: "would-schedule-empty-room-teardown" };
      }
      console.log(
        `[${index + 1}/${objects.length}] ${object.id} ${probe.classification}`,
      );
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      console.warn(
        `[${index + 1}/${objects.length}] ${object.id} error: ${entry.error}`,
      );
    }
    return entry;
  });

  const result = {
    summary: summarize(entries),
    entries,
  };

  if (outputPath) {
    await Bun.write(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  }

  console.log(JSON.stringify(result.summary, null, 2));
};

await main();
