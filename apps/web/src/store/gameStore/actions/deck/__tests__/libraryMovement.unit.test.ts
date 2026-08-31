import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { createExileFromLibrary } from "../exileFromLibrary";
import { createMoveBottomLibraryCardToHand } from "../moveBottomLibraryCardToHand";
import { createMoveTopLibraryCard } from "../moveTopLibraryCard";

const buildState = () => ({
  myPlayerId: "p1",
  viewerRole: "player" as const,
  players: {
    p1: { id: "p1", libraryCount: 5 },
  },
  zones: {
    library: {
      id: "library",
      ownerId: "p1",
      type: ZONE.LIBRARY,
      cardIds: [],
    },
    exile: {
      id: "exile",
      ownerId: "p1",
      type: ZONE.EXILE,
      cardIds: [],
    },
    hand: {
      id: "hand",
      ownerId: "p1",
      type: ZONE.HAND,
      cardIds: [],
    },
    battlefield: {
      id: "battlefield",
      ownerId: "p1",
      type: ZONE.BATTLEFIELD,
      cardIds: [],
    },
  },
});

describe("library movement actions", () => {
  it("dispatches a count-based library exile without exposing card ids", () => {
    const dispatchIntent = vi.fn();
    const state = buildState();
    const action = createExileFromLibrary(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    action("p1", 3, "p1");

    expect(dispatchIntent).toHaveBeenCalledWith({
      type: "library.exile",
      payload: { playerId: "p1", count: 3, actorId: "p1" },
      isRemote: undefined,
    });
    expect(dispatchIntent.mock.calls[0]?.[0]?.payload).not.toHaveProperty("cardId");
  });

  it("dispatches a top-card drop by player and destination only", () => {
    const dispatchIntent = vi.fn();
    const state = buildState();
    const action = createMoveTopLibraryCard(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    action("p1", "battlefield", { x: 0.25, y: 0.75 }, "p1");

    expect(dispatchIntent).toHaveBeenCalledWith({
      type: "library.moveTop",
      payload: {
        playerId: "p1",
        toZoneId: "battlefield",
        position: { x: 0.25, y: 0.75 },
        actorId: "p1",
      },
      isRemote: undefined,
    });
    expect(dispatchIntent.mock.calls[0]?.[0]?.payload).not.toHaveProperty("cardId");
  });

  it("dispatches a bottom-to-hand move without exposing the hidden card id", () => {
    const dispatchIntent = vi.fn();
    const state = buildState();
    const action = createMoveBottomLibraryCardToHand(
      vi.fn() as any,
      (() => state) as any,
      { dispatchIntent } as any,
    );

    action("p1", "p1");

    expect(dispatchIntent).toHaveBeenCalledWith({
      type: "library.moveBottomToHand",
      payload: { playerId: "p1", actorId: "p1" },
      isRemote: undefined,
    });
    expect(dispatchIntent.mock.calls[0]?.[0]?.payload).not.toHaveProperty("cardId");
  });
});
