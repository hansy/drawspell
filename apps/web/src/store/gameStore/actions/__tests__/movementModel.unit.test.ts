import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZONE } from "@/constants/zones";
import type { Card } from "@/types";
import {
  buildMovedCard,
  computeRevealPatchAfterMove,
  normalizeMovePosition,
  planCardMovement,
  resolveFaceDownAfterMove,
} from "../movementModel";

const cachedCards = vi.hoisted(() => new Map<string, any>());

vi.mock("@/services/scryfall/scryfallCache", () => ({
  peekCachedCard: (scryfallId: string) => cachedCards.get(scryfallId) ?? null,
}));

const makeCard = (overrides: Partial<Card> = {}): Card =>
  ({
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Card",
    ownerId: overrides.ownerId ?? "p1",
    controllerId: overrides.controllerId ?? overrides.ownerId ?? "p1",
    zoneId: overrides.zoneId ?? "battlefield-p1",
    tapped: overrides.tapped ?? false,
    faceDown: overrides.faceDown ?? false,
    position: overrides.position ?? { x: 0.5, y: 0.5 },
    rotation: overrides.rotation ?? 0,
    counters: overrides.counters ?? [],
    currentFaceIndex: overrides.currentFaceIndex,
    scryfallId: overrides.scryfallId,
    scryfall: overrides.scryfall,
    power: overrides.power,
    toughness: overrides.toughness,
    basePower: overrides.basePower,
    baseToughness: overrides.baseToughness,
  }) as Card;

describe("movementModel", () => {
  beforeEach(() => {
    cachedCards.clear();
  });

  describe("resolveFaceDownAfterMove", () => {
    it("uses requested faceDown when provided", () => {
      expect(
        resolveFaceDownAfterMove({
          fromZoneType: ZONE.HAND,
          toZoneType: ZONE.BATTLEFIELD,
          currentFaceDown: false,
          currentFaceDownMode: undefined,
          requestedFaceDown: true,
          requestedFaceDownMode: undefined,
        })
      ).toEqual({
        effectiveFaceDown: true,
        patchFaceDown: true,
        effectiveFaceDownMode: undefined,
        patchFaceDownMode: null,
      });
    });

    it("preserves faceDown between battlefields when not specified", () => {
      expect(
        resolveFaceDownAfterMove({
          fromZoneType: ZONE.BATTLEFIELD,
          toZoneType: ZONE.BATTLEFIELD,
          currentFaceDown: true,
          currentFaceDownMode: "morph",
          requestedFaceDown: undefined,
          requestedFaceDownMode: undefined,
        })
      ).toEqual({
        effectiveFaceDown: true,
        patchFaceDown: undefined,
        effectiveFaceDownMode: "morph",
        patchFaceDownMode: undefined,
      });
    });

    it("defaults to face-up outside battlefield-to-battlefield moves", () => {
      expect(
        resolveFaceDownAfterMove({
          fromZoneType: ZONE.BATTLEFIELD,
          toZoneType: ZONE.GRAVEYARD,
          currentFaceDown: true,
          currentFaceDownMode: "morph",
          requestedFaceDown: undefined,
          requestedFaceDownMode: undefined,
        })
      ).toEqual({
        effectiveFaceDown: false,
        patchFaceDown: false,
        effectiveFaceDownMode: undefined,
        patchFaceDownMode: null,
      });
    });
  });

  describe("computeRevealPatchAfterMove", () => {
    it("clears reveal metadata when entering the library", () => {
      expect(
        computeRevealPatchAfterMove({
          fromZoneType: ZONE.BATTLEFIELD,
          toZoneType: ZONE.LIBRARY,
          effectiveFaceDown: false,
        })
      ).toEqual({ knownToAll: false, revealedToAll: false, revealedTo: [] });
    });

    it("clears reveal metadata when landing face-down on the battlefield", () => {
      expect(
        computeRevealPatchAfterMove({
          fromZoneType: ZONE.HAND,
          toZoneType: ZONE.BATTLEFIELD,
          effectiveFaceDown: true,
        })
      ).toEqual({ knownToAll: false, revealedToAll: false, revealedTo: [] });
    });

    it("marks a face-up card as known when entering public zones", () => {
      expect(
        computeRevealPatchAfterMove({
          fromZoneType: ZONE.HAND,
          toZoneType: ZONE.GRAVEYARD,
          effectiveFaceDown: false,
        })
      ).toEqual({ knownToAll: true, revealedToAll: false, revealedTo: [] });
    });

    it("does nothing when moving into hidden zones", () => {
      expect(
        computeRevealPatchAfterMove({
          fromZoneType: ZONE.BATTLEFIELD,
          toZoneType: ZONE.HAND,
          effectiveFaceDown: false,
        })
      ).toBeNull();
    });
  });

  describe("normalizeMovePosition", () => {
    it("migrates legacy pixel coordinates", () => {
      const next = normalizeMovePosition({ x: 100, y: 100 }, { x: 0.5, y: 0.5 });
      expect(next.x).toBeCloseTo(0.1, 6);
      expect(next.y).toBeCloseTo(100 / 600, 6);
    });

    it("clamps and falls back when position is missing", () => {
      expect(normalizeMovePosition(undefined, { x: 2, y: -1 })).toEqual({ x: 1, y: 0 });
    });
  });

  describe("buildMovedCard", () => {
    it("uses cached Scryfall faces when resetting a transformed card", () => {
      cachedCards.set("scryfall-1", {
        id: "scryfall-1",
        layout: "transform",
        card_faces: [
          { name: "Front", power: "1", toughness: "2" },
          { name: "Back", power: "3", toughness: "4" },
        ],
      });

      const card = makeCard({
        scryfallId: "scryfall-1",
        currentFaceIndex: 1,
        power: "3",
        toughness: "4",
        basePower: "3",
        baseToughness: "4",
      });
      const fromZone = { id: "battlefield-p1", type: ZONE.BATTLEFIELD, ownerId: "p1", cardIds: ["c1"] };
      const toZone = { id: "graveyard-p1", type: ZONE.GRAVEYARD, ownerId: "p1", cardIds: [] };

      const plan = planCardMovement({
        card,
        fromZone,
        toZone,
        placement: "top",
      });
      const moved = buildMovedCard(card, plan);

      expect(moved.currentFaceIndex).toBe(0);
      expect(moved.power).toBe("1");
      expect(moved.toughness).toBe("2");
      expect(moved.basePower).toBe("1");
      expect(moved.baseToughness).toBe("2");
    });
  });
});
