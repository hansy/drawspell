import { describe, expect, it } from "vitest";

import {
  buildDrawspellCommandPayload,
  createDiscordCommandRegistrationRequest,
  resolveRegistrationEnvironment,
} from "../registerCommands";

describe("discord command registration", () => {
  it("builds the /drawspell room command payload with three optional player mentions", () => {
    const payload = buildDrawspellCommandPayload();

    expect(payload.name).toBe("drawspell");
    const roomSubcommand = payload.options?.[0];
    expect(roomSubcommand?.name).toBe("room");
    expect(roomSubcommand?.type).toBe(1);
    expect(roomSubcommand && "options" in roomSubcommand).toBe(true);

    const roomOptions =
      roomSubcommand && "options" in roomSubcommand
        ? (roomSubcommand.options ?? []) as Array<{ type: number; name: string }>
        : [];
    expect(roomOptions).toHaveLength(3);
    expect(roomOptions.map((option) => option.type)).toEqual([6, 6, 6]);
    expect(roomOptions.map((option) => option.name)).toEqual([
      "player1",
      "player2",
      "player3",
    ]);
  });

  it("targets guild command registration when guild id is provided", () => {
    const request = createDiscordCommandRegistrationRequest({
      applicationId: "app-123",
      botToken: "bot-token",
      guildId: "guild-456",
      commandPayload: buildDrawspellCommandPayload(),
    });

    expect(request.url).toBe(
      "https://discord.com/api/v10/applications/app-123/guilds/guild-456/commands",
    );
    expect(request.scope).toBe("guild");
    expect(request.init.method).toBe("PUT");
    expect(request.init.headers).toMatchObject({
      authorization: "Bot bot-token",
      "content-type": "application/json",
    });
  });

  it("targets global command registration when guild id is omitted", () => {
    const request = createDiscordCommandRegistrationRequest({
      applicationId: "app-123",
      botToken: "bot-token",
      commandPayload: buildDrawspellCommandPayload(),
    });

    expect(request.url).toBe(
      "https://discord.com/api/v10/applications/app-123/commands",
    );
    expect(request.scope).toBe("global");
  });

  it("hydrates required registration env vars from .dev.vars content", () => {
    const parsed = resolveRegistrationEnvironment({
      env: {},
      envFileContent: `
DISCORD_BOT_TOKEN=file-token
DISCORD_APPLICATION_ID=file-app
DISCORD_COMMAND_GUILD_ID=file-guild
      `,
    });

    expect(parsed.DISCORD_BOT_TOKEN).toBe("file-token");
    expect(parsed.DISCORD_APPLICATION_ID).toBe("file-app");
    expect(parsed.DISCORD_COMMAND_GUILD_ID).toBe("file-guild");
  });

  it("prefers process env values over .dev.vars content", () => {
    const parsed = resolveRegistrationEnvironment({
      env: {
        DISCORD_BOT_TOKEN: "process-token",
      },
      envFileContent: `
DISCORD_BOT_TOKEN=file-token
DISCORD_APPLICATION_ID=file-app
      `,
    });

    expect(parsed.DISCORD_BOT_TOKEN).toBe("process-token");
    expect(parsed.DISCORD_APPLICATION_ID).toBe("file-app");
  });
});
