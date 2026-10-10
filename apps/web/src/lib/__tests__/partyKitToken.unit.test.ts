import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRoomHostPending,
  clearInviteTokenFromUrl,
  resolveInviteTokenFromUrl,
  clearRoomUnavailable,
  ensureClientDeviceId,
  isRoomHostPending,
  isRoomUnavailable,
  markRoomAsHostPending,
  markRoomUnavailable,
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

  it("parses and persists personal invitations through URL cleanup and reconnect", () => {
    const invitation = resolveInviteTokenFromUrl("https://drawspell.space/rooms/room1?invite=private-assignment");
    expect(invitation).toEqual({ personalInvite: "private-assignment", role: "player", playerId: undefined, resumeToken: undefined });
    writeRoomTokensToStorage("room1", { personalInvite: invitation.personalInvite });
    window.history.replaceState({}, "", "/rooms/room1?invite=private-assignment");
    clearInviteTokenFromUrl();
    expect(new URL(window.location.href).searchParams.has("invite")).toBe(false);
    expect(readRoomTokensFromStorage("room1")).toEqual({ personalInvite: "private-assignment" });
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

  it("persists the scoped leave token", () => {
    writeRoomTokensToStorage("session-leave", {
      playerToken: "player-token",
      leaveToken: "leave-token",
      resumeToken: "resume-token",
    });

    expect(readRoomTokensFromStorage("session-leave")).toEqual({
      playerToken: "player-token",
      leaveToken: "leave-token",
    });
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

  it("marks and clears the host pending flag", () => {
    expect(isRoomHostPending("session-host")).toBe(false);

    markRoomAsHostPending("session-host");
    expect(isRoomHostPending("session-host")).toBe(true);

    clearRoomHostPending("session-host");
    expect(isRoomHostPending("session-host")).toBe(false);
  });

  it("marks and clears the room unavailable flag", () => {
    expect(isRoomUnavailable("session-unavailable")).toBe(false);

    markRoomUnavailable("session-unavailable");
    expect(isRoomUnavailable("session-unavailable")).toBe(true);

    clearRoomUnavailable("session-unavailable");
    expect(isRoomUnavailable("session-unavailable")).toBe(false);
  });

  it("persists and reuses a stable client device id", () => {
    const first = ensureClientDeviceId();
    const second = ensureClientDeviceId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(window.localStorage.getItem(deviceKey)).toBe(first);
  });
});
