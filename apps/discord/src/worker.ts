import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import {
  DISCORD_ROOM_PROVISION_PATH,
  type DiscordRoomProvisionRequest,
  type DiscordRoomProvisionResponse,
} from "@mtg/shared/discord/provisioning";
import { verifyKey } from "discord-interactions";
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();

const MAX_TAGGED_RECIPIENTS = 3;
const DISCORD_API_DEFAULT_BASE_URL = "https://discord.com/api/v10";
const INTERACTIONS_LOG_PREFIX = "[discord-interactions]";
const DISCORD_REQUEST_ID_HEADER = "x-discord-request-id";
const DISCORD_SIGNATURE_MAX_AGE_MS = 5 * 60_000;
const DISCORD_SIGNATURE_MAX_FUTURE_SKEW_MS = 30_000;

const discordUserSchema = z.object({
  id: z.string().trim().min(1),
  username: z.string().trim().optional(),
  global_name: z.string().trim().optional(),
  bot: z.boolean().optional(),
});

const interactionSchema = z.object({
  id: z.string().trim().min(1),
  type: z.number(),
  guild_id: z.string().trim().optional(),
  channel_id: z.string().trim().optional(),
  member: z
    .object({
      user: discordUserSchema,
    })
    .optional(),
  user: discordUserSchema.optional(),
  data: z
    .object({
      name: z.string().trim().optional(),
      options: z.array(z.unknown()).optional(),
      resolved: z
        .object({
          users: z.record(z.string(), discordUserSchema).optional(),
        })
        .optional(),
    })
    .optional(),
});

const interactionTypeSchema = z.object({
  type: z.number(),
});

const provisionResponseSchema = z.object({
  roomId: z.string().trim().min(1),
  playerToken: z.string().trim().min(1),
  playerInviteUrl: z.string().trim().min(1),
  expiresAt: z.number(),
  alreadyProvisioned: z.boolean(),
});

const createDmChannelResponseSchema = z.object({
  id: z.string().trim().min(1),
});

type DiscordUser = z.infer<typeof discordUserSchema>;
type ParsedInteraction = z.infer<typeof interactionSchema>;

type RecipientResolution = {
  recipientIds: string[];
  recipientNames: string[];
  truncatedTaggedUsers: boolean;
};

type RecipientFailure = {
  userId: string;
  displayName: string;
};

const interactionResponse = (content: string) =>
  Response.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      flags: MessageFlags.Ephemeral,
    },
  });

const displayNameForUser = (
  user: Pick<DiscordUser, "global_name" | "username" | "id">,
) => user.global_name?.trim() || user.username?.trim() || user.id;

const collectTaggedUserIds = (options: unknown): string[] => {
  const taggedIds: string[] = [];
  const visit = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (record.type === 6 && typeof record.value === "string") {
        taggedIds.push(record.value);
      }
      if (Array.isArray(record.options)) {
        visit(record.options);
      }
    }
  };
  visit(options);
  return taggedIds;
};

const hasCreateSubcommand = (options: unknown): boolean => {
  let foundCreate = false;
  const visit = (nodes: unknown) => {
    if (foundCreate || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (record.type === 1 && record.name === "create") {
        foundCreate = true;
        return;
      }
      if (Array.isArray(record.options)) {
        visit(record.options);
      }
    }
  };
  visit(options);
  return foundCreate;
};

const resolveRoomRecipients = (
  invoker: DiscordUser,
  interaction: ParsedInteraction,
): RecipientResolution => {
  const taggedIds = collectTaggedUserIds(interaction.data?.options);
  const resolvedUsers = interaction.data?.resolved?.users ?? {};
  const includedIds = [invoker.id];
  const recipientNames = [displayNameForUser(invoker)];
  const seenIds = new Set<string>(includedIds);
  let taggedIncludedCount = 0;
  let truncatedTaggedUsers = false;

  for (const taggedId of taggedIds) {
    if (seenIds.has(taggedId)) continue;
    const taggedUser = resolvedUsers[taggedId];
    if (taggedUser?.bot) continue;
    if (taggedIncludedCount >= MAX_TAGGED_RECIPIENTS) {
      truncatedTaggedUsers = true;
      continue;
    }
    seenIds.add(taggedId);
    taggedIncludedCount += 1;
    includedIds.push(taggedId);
    recipientNames.push(taggedUser ? displayNameForUser(taggedUser) : taggedId);
  }

  return {
    recipientIds: includedIds,
    recipientNames,
    truncatedTaggedUsers,
  };
};

const createProvisionRequest = (
  interaction: ParsedInteraction,
  invoker: DiscordUser,
  recipientIds: string[],
): DiscordRoomProvisionRequest => ({
  interactionId: interaction.id,
  guildId: interaction.guild_id ?? "unknown-guild",
  channelId: interaction.channel_id ?? "unknown-channel",
  invokerDiscordUserId: invoker.id,
  participantDiscordUserIds: recipientIds,
});

const callProvisioningEndpoint = async (
  input: {
    SERVER: Env["SERVER"];
    NODE_ENV: string;
    DISCORD_SERVICE_AUTH_SECRET: string;
    requestId: string;
  },
  requestBody: DiscordRoomProvisionRequest,
): Promise<DiscordRoomProvisionResponse> => {
  let response: Response;
  try {
    response = await input.SERVER.fetch(
      `https://${
        input.NODE_ENV === "development"
          ? "drawspell-server-development"
          : "drawspell-server-production"
      }${DISCORD_ROOM_PROVISION_PATH}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.DISCORD_SERVICE_AUTH_SECRET}`,
          [DISCORD_REQUEST_ID_HEADER]: input.requestId,
        },
        body: JSON.stringify(requestBody),
      },
    );
  } catch (error) {
    throw new Error(`Provisioning fetch failed: ${errorMessage(error)}`);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Provisioning request failed with status ${response.status}: ${body.slice(0, 300)}`,
    );
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    throw new Error(
      `Provisioning response JSON parse failed: ${errorMessage(error)}`,
    );
  }
  try {
    return provisionResponseSchema.parse(raw);
  } catch (error) {
    throw new Error(
      `Provisioning response schema parse failed: ${errorMessage(error)}`,
    );
  }
};

const discordApiHeaders = (botToken: string) => ({
  authorization: `Bot ${botToken}`,
  "content-type": "application/json",
});

const readRequiredSecret = (env: Env, key: string): string | null => {
  const raw = (env as unknown as Record<string, unknown>)[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const logInteractionEvent = (
  event: string,
  details: Record<string, unknown>,
) => {
  console.info(INTERACTIONS_LOG_PREFIX, event, details);
};

const errorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown";
};

const timestampAgeMs = (
  timestamp: string | null | undefined,
): number | null => {
  const timestampSeconds = parseUnixTimestampSeconds(timestamp);
  if (timestampSeconds === null) return null;
  return Date.now() - timestampSeconds * 1_000;
};

const parseUnixTimestampSeconds = (
  timestamp: string | null | undefined,
): number | null => {
  if (!timestamp) return null;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return null;
  return timestampSeconds;
};

const isHex = (value: string): boolean => /^[0-9a-f]+$/i.test(value);

const hasExpectedLengthAndHex = (
  value: string,
  expectedLength: number,
): boolean => value.length === expectedLength && isHex(value);

const createDmChannel = async (
  apiBaseUrl: string,
  botToken: string,
  userId: string,
) => {
  const response = await fetch(`${apiBaseUrl}/users/@me/channels`, {
    method: "POST",
    headers: discordApiHeaders(botToken),
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!response.ok) {
    throw new Error(`Create DM channel failed with status ${response.status}`);
  }
  const raw = await response.json();
  return createDmChannelResponseSchema.parse(raw);
};

const sendDmMessage = async (
  apiBaseUrl: string,
  botToken: string,
  channelId: string,
  content: string,
) => {
  const response = await fetch(`${apiBaseUrl}/channels/${channelId}/messages`, {
    method: "POST",
    headers: discordApiHeaders(botToken),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Send DM message failed with status ${response.status}`);
  }
};

const fanOutDmMessage = async ({
  apiBaseUrl,
  botToken,
  recipientIds,
  recipientNames,
  content,
}: {
  apiBaseUrl: string;
  botToken: string;
  recipientIds: string[];
  recipientNames: string[];
  content: string;
}) => {
  const failures: RecipientFailure[] = [];
  for (let i = 0; i < recipientIds.length; i += 1) {
    const userId = recipientIds[i];
    const displayName = recipientNames[i] ?? userId;
    try {
      const dmChannel = await createDmChannel(apiBaseUrl, botToken, userId);
      await sendDmMessage(apiBaseUrl, botToken, dmChannel.id, content);
    } catch (_error) {
      failures.push({ userId, displayName });
    }
  }
  return failures;
};

const buildDmContent = ({
  inviteUrl,
  participantNames,
}: {
  inviteUrl: string;
  participantNames: string[];
}) => {
  const participantList =
    participantNames.length > 0 ? participantNames.join(", ") : "None";
  return [
    `Room ready! Link: ${inviteUrl}`,
    "",
    "Participants:",
    participantList,
    "",
    "Players and spectators can also be invited directly from the link.",
  ].join("\n");
};

const buildCommandConfirmation = ({
  successCount,
  recipientNames,
  failures,
  truncatedTaggedUsers,
}: {
  successCount: number;
  recipientNames: string[];
  failures: RecipientFailure[];
  truncatedTaggedUsers: boolean;
}) => {
  const includedParticipants = recipientNames.join(", ");
  const sections = [
    `DM sent to ${successCount} participant${successCount === 1 ? "" : "s"}.`,
    `Included participants: ${includedParticipants}`,
  ];
  if (truncatedTaggedUsers) {
    sections.push(
      `Included only the first ${MAX_TAGGED_RECIPIENTS} unique non-bot tagged members.`,
    );
  }
  if (failures.length > 0) {
    sections.push(
      `Failed to DM: ${failures.map((failure) => failure.displayName).join(", ")}`,
    );
  }
  return sections.join("\n");
};

app.post("/interactions", async (c) => {
  const requestId = crypto.randomUUID();
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");
  const rawBody = await c.req.text();
  const timestampSeconds = parseUnixTimestampSeconds(timestamp);
  logInteractionEvent("received", {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    contentType: c.req.header("content-type") ?? null,
    hasSignature: Boolean(signature),
    hasTimestamp: Boolean(timestamp),
    signatureLength: signature?.length ?? null,
    signatureLooksLikeHex: signature ? isHex(signature) : null,
    timestampIsNumeric: timestampSeconds !== null,
    timestampUnixSeconds: timestampSeconds,
    timestampAgeMs: timestampAgeMs(timestamp),
    contentLength: rawBody.length,
    userAgent: c.req.header("user-agent") ?? null,
  });

  const discordPublicKey = readRequiredSecret(c.env, "DISCORD_PUBLIC_KEY");
  const discordBotToken = readRequiredSecret(c.env, "DISCORD_BOT_TOKEN");
  const serviceAuthSecret = readRequiredSecret(
    c.env,
    "DISCORD_SERVICE_AUTH_SECRET",
  );
  if (!discordPublicKey || !discordBotToken || !serviceAuthSecret) {
    logInteractionEvent("misconfigured_env", {
      requestId,
      hasDiscordPublicKey: Boolean(discordPublicKey),
      hasDiscordBotToken: Boolean(discordBotToken),
      hasServiceAuthSecret: Boolean(serviceAuthSecret),
    });
    return new Response("Discord worker env is misconfigured", { status: 500 });
  }

  if (!signature || !timestamp) {
    logInteractionEvent("missing_signature_headers", {
      requestId,
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp),
    });
    return new Response("Missing signature headers", { status: 401 });
  }
  if (timestampSeconds === null) {
    logInteractionEvent("invalid_timestamp", { requestId, timestamp });
    return new Response("Invalid request timestamp", { status: 401 });
  }
  const signatureTimestampAgeMs = Date.now() - timestampSeconds * 1_000;
  const isTimestampTooOld =
    signatureTimestampAgeMs > DISCORD_SIGNATURE_MAX_AGE_MS;
  const isTimestampTooFarInFuture =
    signatureTimestampAgeMs < -DISCORD_SIGNATURE_MAX_FUTURE_SKEW_MS;
  if (isTimestampTooOld || isTimestampTooFarInFuture) {
    logInteractionEvent("stale_or_future_timestamp", {
      requestId,
      signatureTimestampAgeMs,
      maxAgeMs: DISCORD_SIGNATURE_MAX_AGE_MS,
      maxFutureSkewMs: DISCORD_SIGNATURE_MAX_FUTURE_SKEW_MS,
    });
    return new Response("Invalid request timestamp", { status: 401 });
  }
  const signatureHeaderLooksValid = hasExpectedLengthAndHex(signature, 128);
  const publicKeyLooksValid = hasExpectedLengthAndHex(discordPublicKey, 64);
  logInteractionEvent("signature_validation_context", {
    requestId,
    signatureHeaderLooksValid,
    publicKeyLooksValid,
    timestampIsNumeric: timestampSeconds !== null,
    timestampAgeMs: timestampAgeMs(timestamp),
    contentLength: rawBody.length,
  });
  const signatureVerificationStart = Date.now();
  const isValidSignature = await verifyKey(
    rawBody,
    signature,
    timestamp,
    discordPublicKey,
  );
  const signatureVerificationDurationMs =
    Date.now() - signatureVerificationStart;
  logInteractionEvent("signature_validation_result", {
    requestId,
    isValidSignature,
    signatureVerificationDurationMs,
  });
  if (!isValidSignature) {
    logInteractionEvent("invalid_signature", {
      requestId,
      timestampAgeMs: timestampAgeMs(timestamp),
    });
    return new Response("Invalid request signature", { status: 401 });
  }

  let rawInteraction: unknown;
  try {
    rawInteraction = JSON.parse(rawBody);
  } catch (_error) {
    logInteractionEvent("invalid_json", { requestId });
    return new Response("Invalid JSON payload", { status: 400 });
  }
  const parsedInteractionType = interactionTypeSchema.safeParse(rawInteraction);
  if (!parsedInteractionType.success) {
    logInteractionEvent("invalid_interaction_type_payload", { requestId });
    return new Response("Invalid interaction payload", { status: 400 });
  }
  if (parsedInteractionType.data.type === InteractionType.Ping) {
    logInteractionEvent("ping_ok", { requestId, signatureValidated: true });
    return Response.json({ type: InteractionResponseType.Pong });
  }

  const parsedInteraction = interactionSchema.safeParse(rawInteraction);
  if (!parsedInteraction.success) {
    logInteractionEvent("invalid_interaction_payload", { requestId });
    return new Response("Invalid interaction payload", { status: 400 });
  }
  const interaction = parsedInteraction.data;

  if (interaction.type !== InteractionType.ApplicationCommand) {
    return interactionResponse("Unsupported interaction type.");
  }
  if (interaction.data?.name !== "drawspell") {
    return interactionResponse("Unsupported command.");
  }
  if (!hasCreateSubcommand(interaction.data?.options)) {
    return interactionResponse("Unsupported command.");
  }
  const invoker = interaction.member?.user ?? interaction.user;
  if (!invoker) {
    return interactionResponse("Could not resolve invoking member.");
  }
  if (!interaction.guild_id || !interaction.channel_id) {
    return interactionResponse("This command must be run in a server channel.");
  }

  const recipients = resolveRoomRecipients(invoker, interaction);
  const provisioningPayload = createProvisionRequest(
    interaction,
    invoker,
    recipients.recipientIds,
  );
  logInteractionEvent("provisioning_request_started", {
    requestId,
    interactionId: interaction.id,
    guildId: interaction.guild_id,
    channelId: interaction.channel_id,
    participants: recipients.recipientIds.length,
  });

  let provisionedRoom: DiscordRoomProvisionResponse;
  try {
    provisionedRoom = await callProvisioningEndpoint(
      {
        SERVER: c.env.SERVER,
        NODE_ENV: c.env.NODE_ENV,
        DISCORD_SERVICE_AUTH_SECRET: serviceAuthSecret,
        requestId,
      },
      provisioningPayload,
    );
    logInteractionEvent("provisioning_request_succeeded", {
      requestId,
      roomId: provisionedRoom.roomId,
      alreadyProvisioned: provisionedRoom.alreadyProvisioned,
    });
  } catch (error) {
    logInteractionEvent("provisioning_failed", {
      requestId,
      interactionId: interaction.id,
      message: errorMessage(error),
    });
    return interactionResponse("Failed to provision a Drawspell room invite.");
  }

  if (provisionedRoom.alreadyProvisioned) {
    return interactionResponse(
      `This /drawspell create request was already processed.\nInvite: ${provisionedRoom.playerInviteUrl}`,
    );
  }

  const dmContent = buildDmContent({
    inviteUrl: provisionedRoom.playerInviteUrl,
    participantNames: recipients.recipientNames,
  });
  const apiBaseUrl = DISCORD_API_DEFAULT_BASE_URL;
  const failures = await fanOutDmMessage({
    apiBaseUrl,
    botToken: discordBotToken,
    recipientIds: recipients.recipientIds,
    recipientNames: recipients.recipientNames,
    content: dmContent,
  });
  const successCount = recipients.recipientIds.length - failures.length;
  logInteractionEvent("command_processed", {
    requestId,
    interactionId: interaction.id,
    recipients: recipients.recipientIds.length,
    dmFailures: failures.length,
    alreadyProvisioned: provisionedRoom.alreadyProvisioned,
  });
  const confirmation = buildCommandConfirmation({
    successCount,
    recipientNames: recipients.recipientNames,
    failures,
    truncatedTaggedUsers: recipients.truncatedTaggedUsers,
  });

  return interactionResponse(confirmation);
});

export default app;
