import { describe, expect, it } from "vitest";

import {
  buildDrawspellCommandPayload,
  createDiscordCommandRegistrationRequest,
  resolveRegistrationEnvironment,
} from "../registerCommands";

describe("discord command registration", () => {
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

  it("hydrates required registration env vars from process env", () => {
    const parsed = resolveRegistrationEnvironment({
      env: {
        DISCORD_BOT_TOKEN: "process-token",
        DISCORD_APPLICATION_ID: "process-app",
        DISCORD_COMMAND_GUILD_ID: "process-guild",
      },
    });

    expect(parsed.DISCORD_BOT_TOKEN).toBe("process-token");
    expect(parsed.DISCORD_APPLICATION_ID).toBe("process-app");
    expect(parsed.DISCORD_COMMAND_GUILD_ID).toBe("process-guild");
  });

  it("trims process env values", () => {
    const parsed = resolveRegistrationEnvironment({
      env: {
        DISCORD_BOT_TOKEN: "  process-token  ",
        DISCORD_APPLICATION_ID: " process-app ",
      },
    });

    expect(parsed.DISCORD_BOT_TOKEN).toBe("process-token");
    expect(parsed.DISCORD_APPLICATION_ID).toBe("process-app");
  });
});
