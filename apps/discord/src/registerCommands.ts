import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { parseArgs } from "node:util";
import { z } from "zod";

const DISCORD_API_DEFAULT_BASE_URL = "https://discord.com/api/v10";

const registrationEnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().trim().min(1),
  DISCORD_APPLICATION_ID: z.string().trim().min(1),
  DISCORD_API_BASE_URL: z.string().trim().url().optional(),
  DISCORD_COMMAND_GUILD_ID: z.string().trim().min(1).optional(),
});

const cliArgsSchema = z.object({
  guildId: z.string().trim().min(1).optional(),
  forceGlobal: z.boolean().optional(),
  apiBaseUrl: z.string().trim().url().optional(),
});

export type CommandRegistrationScope = "guild" | "global";

export type RegistrationRequestInput = {
  applicationId: string;
  botToken: string;
  commandPayload: RESTPostAPIApplicationCommandsJSONBody;
  guildId?: string;
  apiBaseUrl?: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const selectFirstNonEmpty = (
  ...values: Array<string | undefined>
): string | undefined => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

export const resolveRegistrationEnvironment = ({
  env,
}: {
  env: NodeJS.ProcessEnv;
}) => {
  return registrationEnvSchema.parse({
    DISCORD_BOT_TOKEN: selectFirstNonEmpty(env.DISCORD_BOT_TOKEN),
    DISCORD_APPLICATION_ID: selectFirstNonEmpty(env.DISCORD_APPLICATION_ID),
    DISCORD_API_BASE_URL: selectFirstNonEmpty(env.DISCORD_API_BASE_URL),
    DISCORD_COMMAND_GUILD_ID: selectFirstNonEmpty(env.DISCORD_COMMAND_GUILD_ID),
  });
};

export const buildDrawspellCommandPayload =
  (): RESTPostAPIApplicationCommandsJSONBody => ({
    name: "drawspell",
    description:
      "Commands to interact with the Drawspell app (https://drawspell.space)",
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        name: "create",
        description: "Create a Drawspell room for you and others.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "invite1",
            description: "First person to invite",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: "invite2",
            description: "Second person to invite",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: "invite3",
            description: "Third person to invite",
            type: ApplicationCommandOptionType.User,
            required: false,
          },
        ],
      },
    ],
  });

export const createDiscordCommandRegistrationRequest = ({
  applicationId,
  botToken,
  commandPayload,
  guildId,
  apiBaseUrl,
}: RegistrationRequestInput): {
  scope: CommandRegistrationScope;
  url: string;
  init: RequestInit;
} => {
  const normalizedApiBaseUrl = trimTrailingSlash(
    apiBaseUrl ?? DISCORD_API_DEFAULT_BASE_URL,
  );
  const normalizedGuildId = guildId?.trim();
  const scope: CommandRegistrationScope = normalizedGuildId
    ? "guild"
    : "global";
  const url =
    scope === "guild"
      ? `${normalizedApiBaseUrl}/applications/${applicationId}/guilds/${normalizedGuildId}/commands`
      : `${normalizedApiBaseUrl}/applications/${applicationId}/commands`;

  return {
    scope,
    url,
    init: {
      method: "PUT",
      headers: {
        authorization: `Bot ${botToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([commandPayload]),
    },
  };
};

type RegisterDiscordCommandsInput = RegistrationRequestInput & {
  fetchImpl?: typeof fetch;
};

export const registerDiscordCommands = async ({
  fetchImpl = fetch,
  ...input
}: RegisterDiscordCommandsInput): Promise<{
  scope: CommandRegistrationScope;
  url: string;
  status: number;
}> => {
  const request = createDiscordCommandRegistrationRequest(input);
  const response = await fetchImpl(request.url, request.init);
  if (!response.ok) {
    const errorBody = await response.text();
    const errorHint =
      response.status === 403 && errorBody.includes('"code": 50001')
        ? " Hint: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must belong to the same Discord app. For guild registration, the bot must also be installed in that guild."
        : "";
    throw new Error(
      `Discord command registration failed with status ${response.status}: ${errorBody}${errorHint}`,
    );
  }

  return {
    scope: request.scope,
    url: request.url,
    status: response.status,
  };
};

const parseCliArgs = (argv: string[]) => {
  const { values } = parseArgs({
    args: argv,
    options: {
      "guild-id": { type: "string" },
      global: { type: "boolean", default: false },
      "api-base-url": { type: "string" },
    },
    allowPositionals: false,
  });

  return cliArgsSchema.parse({
    guildId: values["guild-id"],
    forceGlobal: values.global,
    apiBaseUrl: values["api-base-url"],
  });
};

export const runRegistrationCli = async (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
) => {
  const parsedArgs = parseCliArgs(argv);
  const parsedEnv = resolveRegistrationEnvironment({ env });
  const guildId = parsedArgs.forceGlobal
    ? undefined
    : (parsedArgs.guildId ?? parsedEnv.DISCORD_COMMAND_GUILD_ID);

  const result = await registerDiscordCommands({
    applicationId: parsedEnv.DISCORD_APPLICATION_ID,
    botToken: parsedEnv.DISCORD_BOT_TOKEN,
    guildId,
    apiBaseUrl: parsedArgs.apiBaseUrl ?? parsedEnv.DISCORD_API_BASE_URL,
    commandPayload: buildDrawspellCommandPayload(),
  });

  // Keep output terse so CI logs remain readable.
  console.log(
    `Registered /drawspell create command (${result.scope}) via ${result.url} [status=${result.status}]`,
  );
};

if (import.meta.main) {
  runRegistrationCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
