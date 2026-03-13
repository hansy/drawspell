import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureClientDeviceId,
  mergeRoomTokens,
  readRoomTokensFromStorage,
  writeRoomTokensToStorage,
} from "../partyKitToken";

const keyFor = (sessionId: string) => `drawspell:roomTokens:${sessionId}`;
const deviceKey = "drawspell:deviceId";

describe("partyKitToken storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not persist resume tokens to storage", () => {
    writeRoomTokensToStorage("session-1", {
      playerToken: "player-token",
      resumeToken: "resume-token",
    });

    expect(window.localStorage.getItem(keyFor("session-1"))).toBe(
      JSON.stringify({ playerToken: "player-token" }),
    );
  });

  it("strips legacy persisted resume-only payloads", () => {
    window.localStorage.setItem(
      keyFor("session-2"),
      JSON.stringify({ resumeToken: "resume-token" }),
    );

    expect(readRoomTokensFromStorage("session-2")).toBeNull();
    expect(window.localStorage.getItem(keyFor("session-2"))).toBeNull();
  });

  it("sanitizes persisted payloads that include resume tokens", () => {
    window.localStorage.setItem(
      keyFor("session-3"),
      JSON.stringify({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
        resumeToken: "resume-token",
      }),
    );

    expect(readRoomTokensFromStorage("session-3")).toEqual({
      playerToken: "player-token",
      spectatorToken: "spectator-token",
    });
    expect(window.localStorage.getItem(keyFor("session-3"))).toBe(
      JSON.stringify({
        playerToken: "player-token",
        spectatorToken: "spectator-token",
      }),
    );
  });

  it("keeps resume tokens available in memory merges", () => {
    expect(
      mergeRoomTokens(
        { playerToken: "player-token" },
        { resumeToken: "resume-token" },
      ),
    ).toEqual({
      playerToken: "player-token",
      resumeToken: "resume-token",
    });
  });

  it("persists and reuses a stable client device id", () => {
    const first = ensureClientDeviceId();
    const second = ensureClientDeviceId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(window.localStorage.getItem(deviceKey)).toBe(first);
  });
});
