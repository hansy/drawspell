import { beforeEach, describe, expect, it } from "vitest";

import {
  getLatestGameLogSeq,
  receiveGameLogEvents,
  replaceGameLog,
  useLogStore,
} from "../logStore";
import type { LogContext } from "../types";

const ctx: LogContext = {
  players: {
    p1: {
      id: "p1",
      name: "Alice",
      life: 20,
      counters: [],
      commanderDamage: {},
      commanderTax: 0,
    },
  },
  cards: {},
  zones: {},
};

describe("logStore game log replay", () => {
  beforeEach(() => {
    useLogStore.getState().clear();
  });

  it("replaces the local Game Log from a server snapshot", () => {
    receiveGameLogEvents([
      {
        seq: 1,
        ts: 100,
        eventId: "player.endTurn",
        payload: { actorId: "p1" },
      },
    ], ctx);

    replaceGameLog([
      {
        seq: 4,
        ts: 200,
        eventId: "library.shuffle",
        payload: { actorId: "p1", playerId: "p1" },
      },
    ], ctx);

    const state = useLogStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.eventId).toBe("library.shuffle");
    expect(getLatestGameLogSeq()).toBe(4);
  });

  it("dedupes replayed and live events by sequence", () => {
    const event = {
      seq: 2,
      ts: 100,
      eventId: "player.endTurn",
      payload: { actorId: "p1" },
    };

    receiveGameLogEvents([event, event], ctx);
    receiveGameLogEvents([event], ctx);

    expect(useLogStore.getState().entries).toHaveLength(1);
    expect(getLatestGameLogSeq()).toBe(2);
  });

  it("preserves replayed lower-sequence events that arrive after newer live events", () => {
    receiveGameLogEvents([
      {
        seq: 2,
        ts: 100,
        eventId: "player.endTurn",
        payload: { actorId: "p1" },
      },
    ], ctx);
    receiveGameLogEvents([
      {
        seq: 1,
        ts: 90,
        eventId: "library.shuffle",
        payload: { actorId: "p1", playerId: "p1" },
      },
    ], ctx);

    const state = useLogStore.getState();
    expect(state.entries).toHaveLength(2);
    expect(state.entries.map((entry) => entry.sourceClientId)).toEqual([1, 2]);
    expect(state.entries.map((entry) => entry.eventId)).toEqual([
      "library.shuffle",
      "player.endTurn",
    ]);
    expect(getLatestGameLogSeq()).toBe(2);
  });
});
