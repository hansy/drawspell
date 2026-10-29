import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/types";
import { undoLastAction, useUndoStore, withUndo } from "../undo";

type MiniState = {
  myPlayerId: string;
  cards: Record<string, any>;
  zones: Record<string, any>;
  players: Record<string, any>;
};

const makeHarness = () => {
  const state: MiniState = {
    myPlayerId: "me",
    cards: {
      c1: {
        id: "c1",
        name: "Island",
        zoneId: "bf-me",
        tapped: false,
        controllerId: "me",
        position: { x: 0.1, y: 0.1 },
        counters: [],
      },
      t1: {
        id: "t1",
        name: "Treasure",
        zoneId: "bf-me",
        tapped: false,
        isToken: true,
        controllerId: "me",
        position: { x: 0.2, y: 0.2 },
        counters: [],
      },
    },
    zones: {
      "bf-me": { id: "bf-me", type: "battlefield", ownerId: "me" },
      "gy-me": { id: "gy-me", type: "graveyard", ownerId: "me" },
      "hand-me": { id: "hand-me", type: "hand", ownerId: "me" },
    },
    players: { me: { id: "me", life: 40, manaPool: {} } },
  };
  const get = () => state as unknown as GameState;
  const base = {
    tapCard: vi.fn((id: string) => {
      state.cards[id] = { ...state.cards[id], tapped: !state.cards[id].tapped };
    }),
    untapAll: vi.fn(() => {
      Object.values(state.cards).forEach((card) => (card.tapped = false));
    }),
    moveCard: vi.fn((id: string, zoneId: string, position?: { x: number; y: number }) => {
      state.cards[id] = { ...state.cards[id], zoneId, position: position ?? state.cards[id].position };
    }),
    updatePlayer: vi.fn((id: string, updates: Record<string, unknown>) => {
      state.players[id] = { ...state.players[id], ...updates };
    }),
    adjustMana: vi.fn((id: string, type: string, delta: number) => {
      const pool = state.players[id].manaPool;
      pool[type] = Math.max(0, (pool[type] ?? 0) + delta);
    }),
    addCounterToCard: vi.fn(),
    removeCounterFromCard: vi.fn(),
  };
  const actions = withUndo(get, base as any);
  return { state, base, actions };
};

describe("withUndo", () => {
  beforeEach(() => useUndoStore.getState().clear());

  it("reverses a tap", () => {
    const { state, actions } = makeHarness();
    actions.tapCard("c1");
    expect(state.cards.c1.tapped).toBe(true);
    expect(undoLastAction()).toEqual({ undone: true, label: "tap Island" });
    expect(state.cards.c1.tapped).toBe(false);
  });

  it("refuses to undo once the card changed since", () => {
    const { state, actions } = makeHarness();
    actions.tapCard("c1");
    state.cards.c1.tapped = false;
    expect(undoLastAction().undone).toBe(false);
  });

  it("moves a card back from the graveyard to its battlefield position", () => {
    const { state, actions } = makeHarness();
    actions.moveCard("c1", "gy-me");
    expect(state.cards.c1.zoneId).toBe("gy-me");
    expect(undoLastAction().undone).toBe(true);
    expect(state.cards.c1.zoneId).toBe("bf-me");
    expect(state.cards.c1.position).toEqual({ x: 0.1, y: 0.1 });
  });

  it("does not record moves into hidden zones or token removals", () => {
    const { actions } = makeHarness();
    actions.moveCard("c1", "hand-me");
    actions.moveCard("t1", "gy-me");
    expect(useUndoStore.getState().entries).toHaveLength(0);
  });

  it("ignores remote and other players' actions", () => {
    const { actions } = makeHarness();
    actions.tapCard("c1", "someone-else");
    actions.tapCard("c1", undefined, true);
    expect(useUndoStore.getState().entries).toHaveLength(0);
  });

  it("restores life and floating mana", () => {
    const { state, actions } = makeHarness();
    actions.updatePlayer("me", { life: 37 });
    actions.adjustMana("me", "R", 1);
    expect(undoLastAction().undone).toBe(true);
    expect(state.players.me.manaPool.R).toBe(0);
    expect(undoLastAction().undone).toBe(true);
    expect(state.players.me.life).toBe(40);
  });

  it("does not record the actions an undo performs", () => {
    const { actions } = makeHarness();
    actions.tapCard("c1");
    undoLastAction();
    expect(useUndoStore.getState().entries).toHaveLength(0);
  });
});
