import { describe, expect, it } from "vitest";

import { ZONE } from "@mtg/shared/constants/zones";
import { planCardMovement } from "@mtg/shared/movement";
import type { Card } from "@mtg/shared/types/cards";
import type { Zone } from "@mtg/shared/types/zones";

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

const makeCard = (
  id: string,
  ownerId: string,
  zoneId: string,
  overrides: Partial<Card> = {}
): Card => ({
  id,
  name: `Card ${id}`,
  ownerId,
  controllerId: ownerId,
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0.25, y: 0.25 },
  rotation: 0,
  counters: [],
  ...overrides,
});

describe("planCardMovement", () => {
  it("plans public zone movement with top placement and public reveal", () => {
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1", ["c1"]);
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const plan = planCardMovement({
      card: makeCard("c1", "p1", graveyard.id, {
        tapped: true,
        counters: [{ type: "+1/+1", count: 2 }],
      }),
      fromZone: graveyard,
      toZone: exile,
      placement: "top",
    });

    expect(plan.visibility).toMatchObject({
      fromHidden: false,
      toHidden: false,
    });
    expect(plan.cardPatch).toMatchObject({
      zoneId: exile.id,
      tapped: false,
      counters: [],
      knownToAll: true,
      revealedToAll: false,
      revealedTo: [],
    });
    expect(plan.logFacts).toMatchObject({
      event: "move",
      fromZoneType: ZONE.GRAVEYARD,
      toZoneType: ZONE.EXILE,
      placement: "top",
      forceHidden: false,
    });
  });

  it("plans bottom placement into Hidden State", () => {
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1", ["c1"]);
    const library = makeZone("lib", ZONE.LIBRARY, "p1");
    const plan = planCardMovement({
      card: makeCard("c1", "p1", graveyard.id, {
        knownToAll: true,
        counters: [{ type: "charge", count: 1 }],
      }),
      fromZone: graveyard,
      toZone: library,
      placement: "bottom",
    });

    expect(plan.visibility).toMatchObject({
      fromHidden: false,
      toHidden: true,
    });
    expect(plan.cardPatch).toMatchObject({
      zoneId: library.id,
      tapped: false,
      counters: [],
      faceDown: false,
      knownToAll: false,
      revealedToAll: false,
      revealedTo: [],
    });
    expect(plan.logFacts).toMatchObject({
      event: "move",
      placement: "bottom",
      forceHidden: true,
      cardName: "a card",
    });
  });

  it("plans Hidden State to public movement with battlefield fallback position", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1", ["c1"]);
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const card = makeCard("c1", "p1", hand.id, {
      counters: [{ type: "+1/+1", count: 1 }],
    });
    const plan = planCardMovement({
      card,
      fromZone: hand,
      toZone: battlefield,
      placement: "top",
    });

    expect(plan.visibility).toMatchObject({
      fromHidden: true,
      toHidden: false,
    });
    expect(plan.cardPatch).toMatchObject({
      zoneId: battlefield.id,
      position: { x: 0.5, y: 0.5 },
      tapped: false,
      counters: card.counters,
      faceDown: false,
      knownToAll: true,
    });
  });

  it("plans Hidden State to Hidden State movement", () => {
    const library = makeZone("lib", ZONE.LIBRARY, "p1", ["c1"]);
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const card = makeCard("c1", "p1", library.id, {
      knownToAll: true,
    });
    const plan = planCardMovement({
      card,
      fromZone: library,
      toZone: hand,
      placement: "top",
    });

    expect(plan.visibility).toMatchObject({
      fromHidden: true,
      toHidden: true,
    });
    expect(plan.cardPatch).toMatchObject({
      zoneId: hand.id,
      tapped: false,
      faceDown: false,
    });
    expect({ ...card, ...plan.cardPatch }).toMatchObject({
      zoneId: hand.id,
      knownToAll: true,
    });
  });

  it("plans face-down battlefield entry and hidden log facts", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1", ["c1"]);
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const plan = planCardMovement({
      card: makeCard("c1", "p1", hand.id),
      fromZone: hand,
      toZone: battlefield,
      placement: "top",
      opts: { faceDown: true, faceDownMode: "morph" },
    });

    expect(plan.enteringFaceDownBattlefield).toBe(true);
    expect(plan.cardPatch).toMatchObject({
      faceDown: true,
      faceDownMode: "morph",
      knownToAll: false,
      revealedToAll: false,
      revealedTo: [],
    });
    expect(plan.logFacts).toMatchObject({
      event: "move",
      forceHidden: true,
      cardName: "a card",
    });
  });

  it("plans commander marking and control changes", () => {
    const battlefield = makeZone("p2-bf", ZONE.BATTLEFIELD, "p2");
    const commander = makeZone("cmd", ZONE.COMMANDER, "p1");
    const toOpponentBattlefield = planCardMovement({
      card: makeCard("c1", "p1", commander.id),
      fromZone: commander,
      toZone: battlefield,
      placement: "top",
    });
    const toCommander = planCardMovement({
      card: makeCard("c2", "p1", battlefield.id),
      fromZone: battlefield,
      toZone: commander,
      placement: "top",
    });

    expect(toOpponentBattlefield.cardPatch.controllerId).toBe("p2");
    expect(toOpponentBattlefield.logFacts).toMatchObject({
      event: "move",
      gainsControlBy: "p2",
    });
    expect(toCommander.shouldMarkCommander).toBe(true);
    expect(toCommander.cardPatch.isCommander).toBe(true);
  });

  it("plans token deletion when a token leaves the battlefield", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1", ["t1"]);
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const plan = planCardMovement({
      card: makeCard("t1", "p1", battlefield.id, { isToken: true }),
      fromZone: battlefield,
      toZone: graveyard,
      placement: "top",
    });

    expect(plan.tokenLeavesBattlefield).toBe(true);
    expect(plan.resetToFrontFace).toBe(true);
    expect(plan.logFacts).toMatchObject({ event: "move" });
  });

  it("plans suppressed draw and discard log facts", () => {
    const library = makeZone("lib", ZONE.LIBRARY, "p1", ["c1"]);
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const card = makeCard("c1", "p1", library.id);

    expect(
      planCardMovement({
        card,
        fromZone: library,
        toZone: hand,
        placement: "top",
        opts: { suppressLog: true },
      }).logFacts
    ).toEqual({ event: "draw", playerId: "p1", count: 1 });
    expect(
      planCardMovement({
        card,
        fromZone: library,
        toZone: graveyard,
        placement: "top",
        opts: { suppressLog: true },
      }).logFacts
    ).toEqual({ event: "discard", playerId: "p1", count: 1 });
  });
});
