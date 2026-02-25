import { InteractionResponseType, InteractionType, MessageFlags } from "discord-api-types/v10";
import { verifyKey } from "discord-interactions";
import { Hono } from "hono";
import { z } from "zod";

type ServiceBinding = {
  fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
};

type Env = {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_SERVICE_AUTH_SECRET: string;
  DISCORD_API_BASE_URL?: string;
  SERVER: ServiceBinding;
};

const app = new Hono<{ Bindings: Env }>();

const MAX_TAGGED_RECIPIENTS = 3;
const DISCORD_API_DEFAULT_BASE_URL = "https://discord.com/api/v10";
const DISCORD_PROVISION_PATH = "/internal/discord/rooms/provision";

const envSchema = z.object({
  DISCORD_PUBLIC_KEY: z.string().trim().min(1),
  DISCORD_BOT_TOKEN: z.string().trim().min(1),
  DISCORD_SERVICE_AUTH_SECRET: z.string().trim().min(1),
  DISCORD_API_BASE_URL: z.string().trim().url().optional(),
  SERVER: z.custom<ServiceBinding>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "fetch" in value &&
      typeof (value as { fetch?: unknown }).fetch === "function",
  ),
});

const discordUserSchema = z.object({
  id: z.string().trim().min(1),
  username: z.string().trim().optional(),
  global_name: z.string().trim().optional(),
  bot: z.boolean().optional(),
});

const interactionSchema = z.object({
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

const provisionResponseSchema = z.object({
  roomId: z.string().trim().min(1),
  playerToken: z.string().trim().min(1),
  playerInviteUrl: z.string().trim().min(1),
  expiresAt: z.number(),
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

const displayNameForUser = (user: Pick<DiscordUser, "global_name" | "username" | "id">) =>
  user.global_name?.trim() || user.username?.trim() || user.id;

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

const hasRoomSubcommand = (options: unknown): boolean => {
  let foundRoom = false;
  const visit = (nodes: unknown) => {
    if (foundRoom || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (record.type === 1 && record.name === "room") {
        foundRoom = true;
        return;
      }
      if (Array.isArray(record.options)) {
        visit(record.options);
      }
    }
  };
  visit(options);
  return foundRoom;
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
    recipientNames.push(
      taggedUser ? displayNameForUser(taggedUser) : taggedId,
    );
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
) => ({
  guildId: interaction.guild_id ?? "unknown-guild",
  channelId: interaction.channel_id ?? "unknown-channel",
  invokerDiscordUserId: invoker.id,
  participantDiscordUserIds: recipientIds,
});

const callProvisioningEndpoint = async (
  env: z.infer<typeof envSchema>,
  requestBody: ReturnType<typeof createProvisionRequest>,
) => {
  const response = await env.SERVER.fetch(
    `https://drawspell-server${DISCORD_PROVISION_PATH}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.DISCORD_SERVICE_AUTH_SECRET}`,
      },
      body: JSON.stringify(requestBody),
    },
  );
  if (!response.ok) {
    throw new Error(`Provisioning request failed with status ${response.status}`);
  }
  const raw = await response.json();
  return provisionResponseSchema.parse(raw);
};

const discordApiHeaders = (botToken: string) => ({
  authorization: `Bot ${botToken}`,
  "content-type": "application/json",
});

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
  const participantList = participantNames.join(", ");
  return [
    "Drawspell room is ready.",
    `Invite: ${inviteUrl}`,
    `Participants: ${participantList}`,
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
  const parsedEnv = envSchema.safeParse(c.env);
  if (!parsedEnv.success) {
    return new Response("Discord worker env is misconfigured", { status: 500 });
  }
  const env = parsedEnv.data;

  const rawBody = await c.req.text();
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");
  if (!signature || !timestamp) {
    return new Response("Missing signature headers", { status: 401 });
  }
  const isValidSignature = verifyKey(
    rawBody,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY,
  );
  if (!isValidSignature) {
    return new Response("Invalid request signature", { status: 401 });
  }

  let rawInteraction: unknown;
  try {
    rawInteraction = JSON.parse(rawBody);
  } catch (_error) {
    return new Response("Invalid JSON payload", { status: 400 });
  }
  const parsedInteraction = interactionSchema.safeParse(rawInteraction);
  if (!parsedInteraction.success) {
    return new Response("Invalid interaction payload", { status: 400 });
  }
  const interaction = parsedInteraction.data;

  if (interaction.type === InteractionType.Ping) {
    return Response.json({ type: InteractionResponseType.Pong });
  }
  if (interaction.type !== InteractionType.ApplicationCommand) {
    return interactionResponse("Unsupported interaction type.");
  }
  if (interaction.data?.name !== "drawspell") {
    return interactionResponse("Unsupported command.");
  }
  if (!hasRoomSubcommand(interaction.data?.options)) {
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

  let provisionedRoom: z.infer<typeof provisionResponseSchema>;
  try {
    provisionedRoom = await callProvisioningEndpoint(env, provisioningPayload);
  } catch (_error) {
    return interactionResponse("Failed to provision a Drawspell room invite.");
  }

  const dmContent = buildDmContent({
    inviteUrl: provisionedRoom.playerInviteUrl,
    participantNames: recipients.recipientNames,
  });
  const apiBaseUrl = env.DISCORD_API_BASE_URL ?? DISCORD_API_DEFAULT_BASE_URL;
  const failures = await fanOutDmMessage({
    apiBaseUrl,
    botToken: env.DISCORD_BOT_TOKEN,
    recipientIds: recipients.recipientIds,
    recipientNames: recipients.recipientNames,
    content: dmContent,
  });
  const successCount = recipients.recipientIds.length - failures.length;
  const confirmation = buildCommandConfirmation({
    successCount,
    recipientNames: recipients.recipientNames,
    failures,
    truncatedTaggedUsers: recipients.truncatedTaggedUsers,
  });

  return interactionResponse(confirmation);
});

export default app;
