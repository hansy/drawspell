import { describe, expect, it } from "vitest";
import { computePeerCounts } from "../peerCount";

type PeerAwarenessState = {
  client?: {
    id?: string;
    role?: "player" | "spectator";
  };
};

describe("computePeerCounts", () => {
  it("deduplicates by user id when present", () => {
    const states = new Map<number, PeerAwarenessState>([
      [1, { client: { id: "u1", role: "player" } }],
      [2, { client: { id: "u1", role: "player" } }],
      [3, { client: { id: "u2", role: "spectator" } }],
    ]);

    expect(computePeerCounts(states)).toEqual({
      total: 2,
      players: 1,
      spectators: 1,
    });
  });

  it("falls back to client id when user id is missing", () => {
    const states = new Map<number, PeerAwarenessState>([
      [1, { client: { role: "player" } }],
      [2, { client: { role: "spectator" } }],
    ]);

    expect(computePeerCounts(states)).toEqual({
      total: 2,
      players: 1,
      spectators: 1,
    });
  });

  it("prefers a player role when the same user appears with mixed roles", () => {
    const states = new Map<number, PeerAwarenessState>([
      [1, { client: { id: "u1", role: "spectator" } }],
      [2, { client: { id: "u1", role: "player" } }],
    ]);

    expect(computePeerCounts(states)).toEqual({
      total: 1,
      players: 1,
      spectators: 0,
    });
  });

  it("never returns less than 1", () => {
    expect(computePeerCounts(new Map())).toEqual({
      total: 1,
      players: 1,
      spectators: 0,
    });
  });
});
