import { describe, expect, it } from "vitest";

import { ZONE } from "@/constants/zones";
import type { Card, Zone } from "@/types";

import {
  buildLibraryManaSections,
  computeZoneViewerCards,
  getZoneViewerMode,
  groupZoneViewerCards,
  sortZoneViewerGroupKeys,
} from "../zoneViewerModel";

const makeCard = (overrides: Partial<Card>): Card =>
  ({
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Card",
    ownerId: overrides.ownerId ?? "p1",
    controllerId: overrides.controllerId ?? overrides.ownerId ?? "p1",
    zoneId: overrides.zoneId ?? "z",
    tapped: overrides.tapped ?? false,
    faceDown: overrides.faceDown ?? false,
    position: overrides.position ?? { x: 0.5, y: 0.5 },
    rotation: overrides.rotation ?? 0,
    counters: overrides.counters ?? [],
    currentFaceIndex: overrides.currentFaceIndex,
    knownToAll: overrides.knownToAll,
    revealedToAll: overrides.revealedToAll,
    revealedTo: overrides.revealedTo,
    power: overrides.power,
    toughness: overrides.toughness,
    basePower: overrides.basePower,
    baseToughness: overrides.baseToughness,
    customText: overrides.customText,
    imageUrl: overrides.imageUrl,
    oracleText: overrides.oracleText,
    typeLine: overrides.typeLine,
    canonicalName: overrides.canonicalName,
    manaCost: overrides.manaCost,
    manaValue: overrides.manaValue,
    scryfallId: overrides.scryfallId,
    scryfall: overrides.scryfall,
    isToken: overrides.isToken,
  }) as any;

describe("zoneViewerModel", () => {
  it("derives view mode", () => {
    const library: Zone = { id: "lib", type: ZONE.LIBRARY, ownerId: "p1", cardIds: [] };
    expect(getZoneViewerMode(library, undefined)).toBe("grouped");
    expect(getZoneViewerMode(library, 3)).toBe("linear");
  });

  it("selects top X cards and honors frozen ids for library", () => {
    const zone: Zone = {
      id: "lib",
      type: ZONE.LIBRARY,
      ownerId: "p1",
      cardIds: ["c1", "c2", "c3", "c4"],
    };
    const cardsById = {
      c1: makeCard({ id: "c1", name: "Card1" }),
      c2: makeCard({ id: "c2", name: "Card2" }),
      c3: makeCard({ id: "c3", name: "Card3" }),
      c4: makeCard({ id: "c4", name: "Card4" }),
    };

    const topTwo = computeZoneViewerCards({
      zone,
      cardsById,
      count: 2,
      filterText: "",
    }).map((c) => c.id);
    expect(topTwo).toEqual(["c3", "c4"]);

    // Freeze to top 3, then remove c4 from the zone: frozen selection should *not* refill.
    const frozen = ["c2", "c3", "c4"];
    const afterRemoval: Zone = { ...zone, cardIds: ["c1", "c2", "c3"] };
    const frozenView = computeZoneViewerCards({
      zone: afterRemoval,
      cardsById,
      count: 3,
      frozenCardIds: frozen,
      filterText: "",
    }).map((c) => c.id);
    expect(frozenView).toEqual(["c2", "c3"]);
  });

  it("filters by face names and oracle text", () => {
    const zone: Zone = {
      id: "gy",
      type: ZONE.GRAVEYARD,
      ownerId: "p1",
      cardIds: ["c1"],
    };
    const cardsById = {
      c1: makeCard({
        id: "c1",
        name: "Mystery",
        oracleText: "Deal 3 damage",
        scryfall: { card_faces: [{ name: "Face Name" }] } as any,
      }),
    };

    expect(
      computeZoneViewerCards({ zone, cardsById, filterText: "face", count: undefined }).map(
        (c) => c.id
      )
    ).toEqual(["c1"]);
    expect(
      computeZoneViewerCards({
        zone,
        cardsById,
        filterText: "damage",
        count: undefined,
      }).map((c) => c.id)
    ).toEqual(["c1"]);
    expect(
      computeZoneViewerCards({
        zone,
        cardsById,
        filterText: "missing",
        count: undefined,
      })
    ).toEqual([]);
  });

  it("groups by lands and cmc and sorts keys", () => {
    const cards = [
      makeCard({ id: "l1", name: "Land", typeLine: "Land" }),
      makeCard({ id: "s1", name: "Spell", scryfall: { cmc: 2 } as any }),
      makeCard({ id: "s0", name: "Zero", scryfall: { cmc: 0 } as any }),
    ];

    const groups = groupZoneViewerCards(cards);
    expect(Object.keys(groups)).toEqual(expect.arrayContaining(["Lands", "Cost 0", "Cost 2"]));
    expect(groups["Lands"]?.map((c) => c.id)).toEqual(["l1"]);

    const sorted = sortZoneViewerGroupKeys(Object.keys(groups));
    expect(sorted[0]).toBe("Lands");
  });

  it("prefers lightweight mana value when grouping cards", () => {
    const cards = [
      makeCard({
        id: "private-overlay-card",
        name: "Three Drop",
        manaValue: 3,
        scryfall: { cmc: 1 } as any,
      }),
    ];

    const groups = groupZoneViewerCards(cards);

    expect(Object.keys(groups)).toEqual(["Cost 3"]);
  });

  it("builds sorted mana sections containing alphabetical canonical-name groups", () => {
    const cards = [
      makeCard({
        id: "bolt-retro",
        name: "Lightning Bolt",
        canonicalName: "Lightning Bolt",
        manaCost: "{R}",
        scryfall: { cmc: 1 } as any,
      }),
      makeCard({
        id: "island",
        name: "Island",
        canonicalName: "Island",
        typeLine: "Basic Land — Island",
      }),
      makeCard({
        id: "abrade",
        name: "Abrade",
        canonicalName: "Abrade",
        manaCost: "{1}{R}",
        scryfall: { cmc: 2 } as any,
      }),
      makeCard({
        id: "bolt-modern",
        name: "Lightning Bolt (Borderless)",
        canonicalName: "Lightning Bolt",
        manaCost: "{R}",
        scryfall: { cmc: 1 } as any,
      }),
      makeCard({
        id: "zero",
        name: "Mox Amber",
        canonicalName: "Mox Amber",
        manaCost: "{0}",
        scryfall: { cmc: 0 } as any,
      }),
      makeCard({
        id: "zwei",
        name: "Zweihander",
        canonicalName: "Zweihander",
        manaCost: "{2}",
        scryfall: { cmc: 2 } as any,
      }),
    ];

    const sections = buildLibraryManaSections(cards);

    expect(sections.map((section) => section.key)).toEqual([
      "Lands",
      "Cost 0",
      "Cost 1",
      "Cost 2",
    ]);
    expect(sections[2]).toMatchObject({
      label: "1-mana",
      manaValue: 1,
      cardCount: 2,
      uniqueCount: 1,
    });
    expect(sections[2]?.groups[0]).toMatchObject({
      name: "Lightning Bolt",
      manaCost: "{R}",
      count: 2,
      representative: { id: "bolt-retro" },
    });
    expect(sections[2]?.groups[0]?.cards.map((card) => card.id)).toEqual([
      "bolt-retro",
      "bolt-modern",
    ]);
    expect(sections[3]?.groups.map((group) => group.name)).toEqual([
      "Abrade",
      "Zweihander",
    ]);
  });

  it("keeps a complete canonical-name group when any copy matches full-library search", () => {
    const zone: Zone = {
      id: "lib",
      type: ZONE.LIBRARY,
      ownerId: "p1",
      cardIds: ["old", "new", "other"],
    };
    const cardsById = {
      old: makeCard({
        id: "old",
        name: "Sky Drake",
        canonicalName: "Sky Drake",
        typeLine: "Creature — Drake",
      }),
      new: makeCard({
        id: "new",
        name: "Sky Drake",
        canonicalName: "Sky Drake",
        typeLine: "Creature — Drake",
        oracleText: "Flying",
      }),
      other: makeCard({
        id: "other",
        name: "Groundling",
        canonicalName: "Groundling",
        typeLine: "Creature — Beast",
      }),
    };

    expect(
      computeZoneViewerCards({ zone, cardsById, filterText: " flying " }).map(
        (card) => card.id
      )
    ).toEqual(["old", "new"]);
  });

  it("keeps top-N library views linear, ordered, and individually filtered", () => {
    const zone: Zone = {
      id: "lib",
      type: ZONE.LIBRARY,
      ownerId: "p1",
      cardIds: ["bottom", "old", "new"],
    };
    const cardsById = {
      bottom: makeCard({ id: "bottom", name: "Bottom" }),
      old: makeCard({
        id: "old",
        name: "Sky Drake",
        canonicalName: "Sky Drake",
      }),
      new: makeCard({
        id: "new",
        name: "Sky Drake",
        canonicalName: "Sky Drake",
        oracleText: "Flying",
      }),
    };

    expect(
      computeZoneViewerCards({ zone, cardsById, count: 2, filterText: "flying" }).map(
        (card) => card.id
      )
    ).toEqual(["new"]);
    expect(
      computeZoneViewerCards({ zone, cardsById, count: 2, filterText: "" }).map(
        (card) => card.id
      )
    ).toEqual(["old", "new"]);
  });
});
