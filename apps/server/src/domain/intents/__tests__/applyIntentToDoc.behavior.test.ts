import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { Card } from "../../../../web/src/types/cards";
import type { Player } from "../../../../web/src/types/players";
import type { Zone } from "../../../../web/src/types/zones";
import { ZONE } from "../../constants";
import { createEmptyHiddenState } from "../../hiddenState";
import { applyIntentToDoc } from "../applyIntentToDoc";
import { getMaps, readPlayer, writePlayer, writeZone } from "../../yjsStore";

const createDoc = () => new Y.Doc();

const makePlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  life: 20,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
  ...overrides,
});

const makeZone = (
  id: string,
  type: Zone["type"],
  ownerId: string,
  cardIds: string[] = []
): Zone => ({
  id,
  type,
  ownerId,
  cardIds,
});

const makeCard = (id: string, ownerId: string, zoneId: string): Card => ({
  id,
  name: `Card ${id}`,
  ownerId,
  controllerId: ownerId,
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
});

describe("applyIntentToDoc", () => {
  it("should reject player joins when the room is locked", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    maps.meta.set("locked", true);
    const hidden = createEmptyHiddenState();

    const result = applyIntentToDoc(doc, {
      id: "intent-1",
      type: "player.join",
      payload: { actorId: "p1", player: makePlayer("p1") },
    }, hidden);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("room locked");
    }
    expect(maps.players.size).toBe(0);
    expect(hidden.handOrder.p1).toBeUndefined();
  });

  it("should set the host and initialize hidden orders for a new player", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    const result = applyIntentToDoc(doc, {
      id: "intent-2",
      type: "player.join",
      payload: { actorId: "p1", player: makePlayer("p1") },
    }, hidden);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hiddenChanged).toBe(true);
    }
    expect(maps.meta.get("hostId")).toBe("p1");
    expect(hidden.handOrder.p1).toEqual([]);
    expect(hidden.libraryOrder.p1).toEqual([]);
    expect(hidden.sideboardOrder.p1).toEqual([]);
  });

  it("should reveal the library top card to all when top reveal is enabled", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    writePlayer(maps, makePlayer("p1"));
    writeZone(maps, makeZone("lib-p1", ZONE.LIBRARY, "p1"));

    hidden.libraryOrder.p1 = ["c1", "c2"];
    hidden.cards.c1 = makeCard("c1", "p1", "lib-p1");
    hidden.cards.c2 = makeCard("c2", "p1", "lib-p1");

    const result = applyIntentToDoc(doc, {
      id: "intent-3",
      type: "player.update",
      payload: {
        actorId: "p1",
        playerId: "p1",
        updates: { libraryTopReveal: "all" },
      },
    }, hidden);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hiddenChanged).toBe(true);
      expect(result.logEvents).toEqual([
        {
          eventId: "library.topReveal",
          payload: { actorId: "p1", playerId: "p1", enabled: true, mode: "all" },
        },
      ]);
    }

    const topEntry = maps.libraryRevealsToAll.get("c2");
    expect(topEntry).toMatchObject({ ownerId: "p1" });
    const player = readPlayer(maps, "p1");
    expect(player?.libraryTopReveal).toBe("all");
  });
});
