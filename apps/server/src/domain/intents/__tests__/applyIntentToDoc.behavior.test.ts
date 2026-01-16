import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { Card } from "../../../../web/src/types/cards";
import type { Player } from "../../../../web/src/types/players";
import type { Zone } from "../../../../web/src/types/zones";
import { ZONE } from "../../constants";
import { createEmptyHiddenState } from "../../hiddenState";
import { applyIntentToDoc } from "../applyIntentToDoc";
import {
  getMaps,
  readPlayer,
  readZone,
  writeCard,
  writePlayer,
  writeZone,
} from "../../yjsStore";

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

  it("should add cards to a hidden zone for the owning player", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    writePlayer(maps, makePlayer("p1"));
    writeZone(maps, makeZone("hand-p1", ZONE.HAND, "p1"));

    const result = applyIntentToDoc(doc, {
      id: "intent-4",
      type: "card.add",
      payload: {
        actorId: "p1",
        card: makeCard("c1", "p1", "hand-p1"),
      },
    }, hidden);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hiddenChanged).toBe(true);
    }
    expect(hidden.handOrder.p1).toEqual(["c1"]);
    expect(hidden.cards.c1?.zoneId).toBe("hand-p1");
    expect(maps.cards.get("c1")).toBeUndefined();
    expect(readZone(maps, "hand-p1")?.cardIds).toEqual(["c1"]);
    expect(readPlayer(maps, "p1")?.handCount).toBe(1);
  });

  it("should reject card adds into hidden zones owned by other players", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    writePlayer(maps, makePlayer("p1"));
    writeZone(maps, makeZone("hand-p1", ZONE.HAND, "p1"));

    const result = applyIntentToDoc(doc, {
      id: "intent-5",
      type: "card.add",
      payload: {
        actorId: "p2",
        card: makeCard("c1", "p1", "hand-p1"),
      },
    }, hidden);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Cannot place into a hidden zone you do not own");
    }
    expect(hidden.handOrder.p1).toBeUndefined();
    expect(maps.cards.get("c1")).toBeUndefined();
  });

  it("should redact card names when moving to hidden zones", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    const battlefield = makeZone("bf-p1", ZONE.BATTLEFIELD, "p1", ["c1"]);
    const hand = makeZone("hand-p1", ZONE.HAND, "p1");
    writeZone(maps, battlefield);
    writeZone(maps, hand);
    writeCard(maps, makeCard("c1", "p1", battlefield.id));

    const result = applyIntentToDoc(doc, {
      id: "intent-6",
      type: "card.move",
      payload: { actorId: "p1", cardId: "c1", toZoneId: hand.id },
    }, hidden);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hiddenChanged).toBe(true);
      expect(result.logEvents).toHaveLength(1);
      expect(result.logEvents[0]).toMatchObject({
        eventId: "card.move",
        payload: { cardName: "a card", forceHidden: true },
      });
    }
    expect(hidden.handOrder.p1).toEqual(["c1"]);
    expect(hidden.cards.c1?.zoneId).toBe(hand.id);
    expect(maps.cards.get("c1")).toBeUndefined();
    expect(readZone(maps, battlefield.id)?.cardIds).toEqual([]);
  });

  it("should reject deck resets when the actor cannot view the library", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    writePlayer(maps, makePlayer("p1"));
    writeZone(maps, makeZone("lib-p1", ZONE.LIBRARY, "p1"));

    const result = applyIntentToDoc(doc, {
      id: "intent-7",
      type: "deck.reset",
      payload: { actorId: "p2", playerId: "p1" },
    }, hidden);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Hidden zone");
    }
  });

  it("should log deck reset events for allowed actors", () => {
    const doc = createDoc();
    const maps = getMaps(doc);
    const hidden = createEmptyHiddenState();

    writePlayer(maps, makePlayer("p1", { libraryTopReveal: "all" }));
    writeZone(maps, makeZone("lib-p1", ZONE.LIBRARY, "p1"));
    writeZone(maps, makeZone("hand-p1", ZONE.HAND, "p1"));

    hidden.libraryOrder.p1 = ["c1", "c2"];
    hidden.cards.c1 = makeCard("c1", "p1", "lib-p1");
    hidden.cards.c2 = makeCard("c2", "p1", "lib-p1");

    const result = applyIntentToDoc(doc, {
      id: "intent-8",
      type: "deck.reset",
      payload: { actorId: "p1", playerId: "p1" },
    }, hidden);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hiddenChanged).toBe(true);
      expect(result.logEvents).toEqual([
        { eventId: "deck.reset", payload: { actorId: "p1", playerId: "p1" } },
      ]);
    }
    expect(hidden.handOrder.p1).toEqual([]);
    expect(readPlayer(maps, "p1")?.libraryTopReveal).toBeUndefined();
  });
});
