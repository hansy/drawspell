import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Card, Player, Zone } from "@/types";
import { useGameStore } from "@/store/gameStore";
import { ZONE } from "@/constants/zones";

import { CardFace } from "../CardFace";

const cachedCards = vi.hoisted(() => new Map<string, any>());
const cacheListeners = vi.hoisted(
  () => new Set<(scryfallIds: readonly string[]) => void>(),
);

vi.mock("@/services/scryfall/scryfallCache", () => ({
  peekCachedCard: (scryfallId: string) => cachedCards.get(scryfallId) ?? null,
  subscribeCachedCards: (listener: (scryfallIds: readonly string[]) => void) => {
    cacheListeners.add(listener);
    return () => {
      cacheListeners.delete(listener);
    };
  },
}));

const buildZone = (id: string, type: keyof typeof ZONE, ownerId: string): Zone => ({
  id,
  type: ZONE[type],
  ownerId,
  cardIds: [],
});

const buildPlayer = (id: string, name: string): Player => ({
  id,
  name,
  life: 20,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

const buildTransformCard = (zoneId: string): Card => ({
  id: "c1",
  name: "Transform Card",
  ownerId: "me",
  controllerId: "me",
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
  currentFaceIndex: 1,
  power: "3",
  toughness: "2",
  basePower: "3",
  baseToughness: "2",
  scryfall: {
    id: "s1",
    layout: "transform",
    card_faces: [
      { name: "Front", power: "1", toughness: "1" },
      { name: "Back", power: "3", toughness: "2" },
    ],
  },
});

describe("CardFace", () => {
  beforeEach(() => {
    cachedCards.clear();
    cacheListeners.clear();
    useGameStore.setState({
      zones: {},
      cards: {},
      players: {},
      myPlayerId: "me",
      globalCounters: {},
    });
  });

  it("renders transform flip faces with their own stats", () => {
    const zone = buildZone("bf-me", "BATTLEFIELD", "me");
    const card = buildTransformCard(zone.id);

    useGameStore.setState((state) => ({
      ...state,
      zones: { ...state.zones, [zone.id]: zone },
      cards: { ...state.cards, [card.id]: card },
      players: { me: buildPlayer("me", "Me") },
    }));

    render(<CardFace card={card} />);

    expect(screen.queryAllByText("1")).toHaveLength(2);
  });

  it("preserves PT overrides on the active face during transform flips", () => {
    const zone = buildZone("bf-me", "BATTLEFIELD", "me");
    const card = {
      ...buildTransformCard(zone.id),
      power: "9",
      toughness: "8",
      basePower: "3",
      baseToughness: "2",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { ...state.zones, [zone.id]: zone },
      cards: { ...state.cards, [card.id]: card },
      players: { me: buildPlayer("me", "Me") },
    }));

    render(<CardFace card={card} />);

    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("rerenders artwork when the scryfall cache fills after mount", async () => {
    const zone = buildZone("hand-me", "HAND", "me");
    const card: Card = {
      id: "c-cache",
      name: "Cache Test",
      ownerId: "me",
      controllerId: "me",
      zoneId: zone.id,
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
      scryfallId: "s-cache",
    };

    useGameStore.setState((state) => ({
      ...state,
      zones: { ...state.zones, [zone.id]: zone },
      cards: { ...state.cards, [card.id]: card },
      players: { me: buildPlayer("me", "Me") },
    }));

    render(<CardFace card={card} />);

    expect(screen.getByText("Cache Test")).toBeTruthy();

    act(() => {
      cachedCards.set("s-cache", {
        id: "s-cache",
        name: "Cache Test",
        image_uris: {
          normal: "https://example.com/cache-test.jpg",
        },
      });
      cacheListeners.forEach((listener) => listener(["s-cache"]));
    });

    const img = await screen.findByRole("img", { name: "Cache Test" });
    expect(img.getAttribute("src")).toBe("https://example.com/cache-test.jpg");
  });
});
