import { describe, expect, it } from "vitest";

import type { Card } from "@mtg/shared/types/cards";

import { buildCardIdentity, stripCardIdentity, toCardLite } from "../cards";

const card: Card = {
  id: "card-1",
  ownerId: "player-1",
  controllerId: "player-1",
  zoneId: "library-1",
  name: "Fire",
  canonicalName: "Fire // Ice",
  manaCost: "{1}{R} // {1}{U}",
  manaValue: 2,
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
};

describe("card identity metadata", () => {
  it("retains compact grouping metadata in identities and private overlays", () => {
    expect(buildCardIdentity(card)).toMatchObject({
      canonicalName: "Fire // Ice",
      manaCost: "{1}{R} // {1}{U}",
      manaValue: 2,
    });
    expect(toCardLite(card)).toMatchObject({
      canonicalName: "Fire // Ice",
      manaCost: "{1}{R} // {1}{U}",
      manaValue: 2,
    });
  });

  it("removes grouping metadata when public identity is hidden", () => {
    expect(stripCardIdentity(card)).toMatchObject({
      name: "Card",
      canonicalName: undefined,
      manaCost: undefined,
      manaValue: undefined,
    });
  });
});
