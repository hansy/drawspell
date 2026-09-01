import { describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { createTurnExiledCardFaceUp } from "../turnExiledCardFaceUp";

const buildState = (overrides: Record<string, unknown> = {}) => ({
  myPlayerId: "p1",
  viewerRole: "player" as const,
  cards: {
    c1: {
      id: "c1",
      ownerId: "p1",
      controllerId: "p1",
      zoneId: "exile",
      faceDown: true,
    },
  },
  zones: {
    exile: {
      id: "exile",
      ownerId: "p1",
      type: ZONE.EXILE,
      cardIds: ["c1"],
    },
  },
  ...overrides,
});

describe("turnExiledCardFaceUp", () => {
  it("dispatches the dedicated server intent for the exile zone owner", () => {
    const dispatchIntent = vi.fn();
    const state = buildState();
    const action = createTurnExiledCardFaceUp(
      vi.fn() as never,
      (() => state) as never,
      { dispatchIntent } as never,
    );

    action("c1", "p1");

    expect(dispatchIntent).toHaveBeenCalledWith({
      type: "card.faceUp",
      payload: { cardId: "c1", actorId: "p1" },
      isRemote: undefined,
    });
  });

  it("does not dispatch for spectators", () => {
    const dispatchIntent = vi.fn();
    const state = buildState({ viewerRole: "spectator" });
    const action = createTurnExiledCardFaceUp(
      vi.fn() as never,
      (() => state) as never,
      { dispatchIntent } as never,
    );

    action("c1", "p1");

    expect(dispatchIntent).not.toHaveBeenCalled();
  });
});
