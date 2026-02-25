import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { readFileSync } from "node:fs";
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
  envFile: z.string().trim().min(1).optional(),
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

const parseEnvFileContent = (content: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalizedLine = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = normalizedLine.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    let value = normalizedLine.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

export const resolveRegistrationEnvironment = ({
  env,
  envFileContent,
}: {
  env: NodeJS.ProcessEnv;
  envFileContent?: string;
}) => {
  const fileEnvValues = envFileContent
    ? parseEnvFileContent(envFileContent)
    : {};

  return registrationEnvSchema.parse({
    DISCORD_BOT_TOKEN: selectFirstNonEmpty(
      env.DISCORD_BOT_TOKEN,
      fileEnvValues.DISCORD_BOT_TOKEN,
    ),
    DISCORD_APPLICATION_ID: selectFirstNonEmpty(
      env.DISCORD_APPLICATION_ID,
      fileEnvValues.DISCORD_APPLICATION_ID,
    ),
    DISCORD_API_BASE_URL: selectFirstNonEmpty(
      env.DISCORD_API_BASE_URL,
      fileEnvValues.DISCORD_API_BASE_URL,
    ),
    DISCORD_COMMAND_GUILD_ID: selectFirstNonEmpty(
      env.DISCORD_COMMAND_GUILD_ID,
      fileEnvValues.DISCORD_COMMAND_GUILD_ID,
    ),
  });
};

const loadOptionalEnvFile = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
};

export const buildDrawspellCommandPayload = (): RESTPostAPIApplicationCommandsJSONBody => ({
  name: "drawspell",
  description: "Create a Drawspell room and DM invite links.",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "room",
      description: "Create a room and DM participant invite links.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "player1",
          description: "First player to include in the room invite.",
          type: ApplicationCommandOptionType.User,
          required: false,
        },
        {
          name: "player2",
          description: "Second player to include in the room invite.",
          type: ApplicationCommandOptionType.User,
          required: false,
        },
        {
          name: "player3",
          description: "Third player to include in the room invite.",
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
  const scope: CommandRegistrationScope = normalizedGuildId ? "guild" : "global";
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
    throw new Error(
      `Discord command registration failed with status ${response.status}: ${errorBody}`,
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
      "env-file": { type: "string", default: ".dev.vars" },
    },
    allowPositionals: false,
  });

  return cliArgsSchema.parse({
    guildId: values["guild-id"],
    forceGlobal: values.global,
    apiBaseUrl: values["api-base-url"],
    envFile: values["env-file"],
  });
};

export const runRegistrationCli = async (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
) => {
  const parsedArgs = parseCliArgs(argv);
  const envFileContent = parsedArgs.envFile
    ? loadOptionalEnvFile(parsedArgs.envFile)
    : undefined;
  const parsedEnv = resolveRegistrationEnvironment({ env, envFileContent });
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
    `Registered /drawspell command (${result.scope}) via ${result.url} [status=${result.status}]`,
  );
};

if (import.meta.main) {
  runRegistrationCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
