import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildDurableObjectDailyCheck,
  buildDurableObjectMetricsReport,
  type DurableObjectInvocationRow,
  type DurableObjectPeriodicRow,
  type WorkerDeploymentTimestamp,
  resolveDurableObjectMetricsWindow,
  selectLatestWorkerDeploymentTimestamp,
  summarizeDurableObjectMetrics,
} from "../src/observability/durableObjectMetrics";

type GraphqlResponse = {
  data?: {
    viewer?: {
      accounts?: Array<{
        periodic: DurableObjectPeriodicRow[];
        invocations: DurableObjectInvocationRow[];
      }>;
    };
  };
  errors?: unknown[];
};

type WorkerDeploymentsResponse = {
  result?: { deployments?: WorkerDeploymentTimestamp[] } | WorkerDeploymentTimestamp[];
  errors?: unknown[];
};

const GRAPHQL_QUERY_LIMIT = 10000;
const DEFAULT_METRIC_SETTLE_DELAY_MINUTES = 15;

const args = process.argv.slice(2);

const readArg = (name: string) => {
  const idx = args.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const hasFlag = (name: string) => args.includes(`--${name}`);

const hasCloudflareErrors = (errors: unknown[] | undefined) =>
  Array.isArray(errors) && errors.length > 0;

const usage = () => {
  console.error(
    [
      "Usage: bun apps/server/scripts/do-metrics.ts --deployAt <iso> [options]",
      "",
      "Options:",
      "  --account <id>       Cloudflare account id. Defaults to CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID.",
      "  --token <token>      Cloudflare API token. Defaults to CLOUDFLARE_API_TOKEN, CF_API_TOKEN, or Wrangler OAuth config.",
      "  --deployAt <iso|latest>  Deployment timestamp, or latest to fetch the current Worker deployment.",
      "  --scriptName <name>  Worker script name. Defaults to drawspell-server-production.",
      "  --namespaceId <id>   Optional Durable Object namespace id for periodic metrics.",
      "  --hours <n>          Window length ending at --end or now. Defaults to 24.",
      "  --start <iso>        Explicit window start.",
      "  --end <iso>          Explicit window end. Defaults to now.",
      "  --top <n>            Number of rooms to include. Defaults to 25.",
      "  --checkDaily        Exit non-zero until a full post-deploy daily assessment passes.",
      "  --durationLimitSec <n>  Optional daily DO duration limit for --checkDaily.",
      "  --metricSettleDelayMinutes <n>  Minutes to wait after the daily window before --checkDaily can pass. Defaults to 15.",
      "  --pretty            Pretty-print JSON.",
    ].join("\n"),
  );
};

const readWranglerOAuthToken = () => {
  const path = join(
    homedir(),
    "Library/Preferences/.wrangler/config/default.toml",
  );
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  return text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1] ?? null;
};

const token =
  readArg("token") ??
  process.env.CLOUDFLARE_API_TOKEN ??
  process.env.CF_API_TOKEN ??
  readWranglerOAuthToken();
const accountTag =
  readArg("account") ??
  process.env.CLOUDFLARE_ACCOUNT_ID ??
  process.env.CF_ACCOUNT_ID;
const deployAt = readArg("deployAt");
const scriptName = readArg("scriptName") ?? "drawspell-server-production";
const namespaceId = readArg("namespaceId") ?? undefined;
const topRoomLimit = Number(readArg("top") ?? "25");
const durationLimitSecRaw = readArg("durationLimitSec");
const durationLimitSec =
  durationLimitSecRaw === null ? undefined : Number(durationLimitSecRaw);
const metricSettleDelayMinutes = Number(
  readArg("metricSettleDelayMinutes") ??
    String(DEFAULT_METRIC_SETTLE_DELAY_MINUTES),
);
const endArg = readArg("end");
const startArg = readArg("start");
const hours = Number(readArg("hours") ?? "24");

if (!token || !accountTag || !deployAt) {
  usage();
  process.exit(1);
}

if (endArg !== null && Number.isNaN(Date.parse(endArg))) {
  console.error("--end must be a valid ISO timestamp");
  process.exit(1);
}

if (startArg !== null && Number.isNaN(Date.parse(startArg))) {
  console.error("--start must be a valid ISO timestamp");
  process.exit(1);
}

if (!Number.isFinite(hours) || hours <= 0) {
  console.error("--hours must be a positive number");
  process.exit(1);
}

if (
  durationLimitSec !== undefined &&
  (!Number.isFinite(durationLimitSec) || durationLimitSec <= 0)
) {
  console.error("--durationLimitSec must be a positive number");
  process.exit(1);
}

if (
  !Number.isFinite(metricSettleDelayMinutes) ||
  metricSettleDelayMinutes < 0
) {
  console.error("--metricSettleDelayMinutes must be a non-negative number");
  process.exit(1);
}

const readDeploymentRows = (body: WorkerDeploymentsResponse) => {
  if (Array.isArray(body.result)) return body.result;
  return body.result?.deployments ?? [];
};

const fetchLatestDeployAt = async () => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountTag)}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  const body = (await response.json()) as WorkerDeploymentsResponse;
  if (!response.ok || hasCloudflareErrors(body.errors)) {
    console.error(
      JSON.stringify(
        {
          status: response.status,
          errors: body.errors ?? null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  return selectLatestWorkerDeploymentTimestamp(readDeploymentRows(body));
};

const resolvedDeployAt =
  deployAt === "latest" ? await fetchLatestDeployAt() : deployAt;

if (Number.isNaN(Date.parse(resolvedDeployAt))) {
  console.error("--deployAt must be a valid ISO timestamp or latest");
  process.exit(1);
}

const window = resolveDurableObjectMetricsWindow({
  deployAt: resolvedDeployAt,
  start: startArg,
  end: endArg,
  hours,
  checkDaily: hasFlag("checkDaily"),
});

const query = `query DurableObjectMetrics($accountTag: string!, $start: Time!, $end: Time!, $scriptName: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      periodic: durableObjectsPeriodicGroups(
        limit: ${GRAPHQL_QUERY_LIMIT}
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [datetimeFiveMinutes_ASC]
      ) {
        dimensions { datetimeFiveMinutes name namespaceId objectId }
        sum {
          duration
          activeTime
          cpuTime
          inboundWebsocketMsgCount
          outboundWebsocketMsgCount
          subrequests
          storageReadUnits
          storageWriteUnits
          rowsRead
          rowsWritten
        }
      }
      invocations: durableObjectsInvocationsAdaptiveGroups(
        limit: ${GRAPHQL_QUERY_LIMIT}
        filter: { datetime_geq: $start, datetime_lt: $end, scriptName: $scriptName }
        orderBy: [datetimeFiveMinutes_ASC]
      ) {
        dimensions { datetimeFiveMinutes name namespaceId status type }
        sum { requests wallTime errors }
      }
    }
  }
}`;

const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag,
      start: window.start,
      end: window.end,
      scriptName,
    },
  }),
});

const body = (await response.json()) as GraphqlResponse;
if (!response.ok || hasCloudflareErrors(body.errors)) {
  console.error(
    JSON.stringify(
      {
        status: response.status,
        errors: body.errors ?? null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const account = body.data?.viewer?.accounts?.[0];
if (!account) {
  console.error("No Cloudflare account metrics returned.");
  process.exit(1);
}

const summary = summarizeDurableObjectMetrics({
  windowStart: window.start,
  deployAt: resolvedDeployAt,
  windowEnd: window.end,
  periodic: account.periodic,
  invocations: account.invocations,
  namespaceId,
  topRoomLimit: Number.isFinite(topRoomLimit) ? topRoomLimit : 25,
  queryLimit: GRAPHQL_QUERY_LIMIT,
});

const dailyCheck = hasFlag("checkDaily")
  ? buildDurableObjectDailyCheck(summary, {
      durationLimitSec,
      metricSettleDelayMinutes,
    })
  : undefined;
const report = buildDurableObjectMetricsReport(summary, dailyCheck);

console.log(JSON.stringify(report, null, hasFlag("pretty") ? 2 : 0));

if (dailyCheck) {
  console.error(dailyCheck.message);
  if (dailyCheck.exitCode !== 0) {
    process.exit(dailyCheck.exitCode);
  }
}
