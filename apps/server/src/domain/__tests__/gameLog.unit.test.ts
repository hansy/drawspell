import { describe, expect, it } from "vitest";

import { GameLogBuffer } from "../gameLog";

describe("GameLogBuffer", () => {
  it("assigns ordered room-local sequence numbers and retains the newest entries", () => {
    const log = new GameLogBuffer(3);

    log.append([
      { eventId: "player.endTurn", payload: { actorId: "p1" } },
      { eventId: "dice.roll", payload: { actorId: "p1", result: 4 } },
    ], 100);
    log.append([
      { eventId: "coin.flip", payload: { actorId: "p2", result: "heads" } },
      { eventId: "library.view", payload: { actorId: "p2", playerId: "p2" } },
    ], 200);

    expect(log.snapshot()).toEqual({
      nextSeq: 5,
      entries: [
        {
          seq: 2,
          ts: 100,
          eventId: "dice.roll",
          payload: { actorId: "p1", result: 4 },
        },
        {
          seq: 3,
          ts: 200,
          eventId: "coin.flip",
          payload: { actorId: "p2", result: "heads" },
        },
        {
          seq: 4,
          ts: 200,
          eventId: "library.view",
          payload: { actorId: "p2", playerId: "p2" },
        },
      ],
    });
  });

  it("returns incremental replay for fresh cursors and snapshot fallback for missing or stale cursors", () => {
    const log = new GameLogBuffer(2);
    log.append([
      { eventId: "a", payload: {} },
      { eventId: "b", payload: {} },
      { eventId: "c", payload: {} },
    ], 100);

    expect(log.replayAfter(2)).toEqual({
      kind: "replay",
      entries: [{ seq: 3, ts: 100, eventId: "c", payload: {} }],
    });
    expect(log.replayAfter(undefined).kind).toBe("snapshot");
    expect(log.replayAfter(0).kind).toBe("snapshot");
    expect(log.replayAfter(99).kind).toBe("snapshot");
  });

  it("restores persisted snapshots and continues sequence numbers", () => {
    const restored = new GameLogBuffer(10);
    restored.restore({
      nextSeq: 4,
      entries: [
        { seq: 1, ts: 100, eventId: "a", payload: {} },
        { seq: 3, ts: 100, eventId: "c", payload: {} },
      ],
    });

    const [entry] = restored.append([{ eventId: "d", payload: {} }], 200);
    expect(entry).toEqual({ seq: 4, ts: 200, eventId: "d", payload: {} });
  });
});
