import { describe, expect, it } from "vitest";

import { archidektDeckToDecklist, parseArchidektDeckId } from "../archidektImport";

describe("parseArchidektDeckId", () => {
  it("reads deck ids from Archidekt links", () => {
    expect(parseArchidektDeckId("https://archidekt.com/decks/25335850/atraxa")).toBe("25335850");
    expect(parseArchidektDeckId("archidekt.com/decks/12")).toBe("12");
    expect(parseArchidektDeckId("  https://www.archidekt.com/decks/9?tab=1  ")).toBe("9");
  });

  it("ignores decklists and other sites", () => {
    expect(parseArchidektDeckId("4 Lightning Bolt")).toBeNull();
    expect(parseArchidektDeckId("https://moxfield.com/decks/abc")).toBeNull();
  });
});

describe("archidektDeckToDecklist", () => {
  it("splits commander, main deck and sideboard and skips the maybeboard", () => {
    const text = archidektDeckToDecklist({
      categories: [
        { name: "Commander", includedInDeck: true, isPremier: true },
        { name: "Land", includedInDeck: true },
        { name: "Sideboard", includedInDeck: true },
        { name: "Maybeboard", includedInDeck: false },
      ],
      cards: [
        { quantity: 1, categories: ["Commander"], card: { oracleCard: { name: "Atraxa, Grand Unifier" } } },
        { quantity: 30, categories: ["Land"], card: { oracleCard: { name: "Forest" } } },
        { quantity: 1, categories: ["Sideboard"], card: { oracleCard: { name: "Duress" } } },
        { quantity: 1, categories: ["Maybeboard"], card: { oracleCard: { name: "Opt" } } },
        { quantity: 1, categories: ["Land"], deletedAt: "2026-01-01", card: { oracleCard: { name: "Swamp" } } },
      ],
    });
    expect(text).toBe(
      "Commander:\n1 Atraxa, Grand Unifier\n\nDeck:\n30 Forest\n\nSideboard:\n1 Duress",
    );
  });
});
