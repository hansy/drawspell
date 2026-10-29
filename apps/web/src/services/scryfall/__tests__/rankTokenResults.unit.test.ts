import { describe, expect, it } from "vitest";

import { rankTokenResults } from "../scryfallTokens";

describe("rankTokenResults", () => {
  it("puts the exact token ahead of double-faced tokens that share its name", () => {
    const ranked = rankTokenResults("treasure", [
      { name: "Dinosaur // Treasure" },
      { name: "Merfolk // Treasure" },
      { name: "Sculpture Treasure" },
      { name: "Treasure" },
    ]);
    expect(ranked.map((card) => card.name)).toEqual([
      "Treasure",
      "Dinosaur // Treasure",
      "Merfolk // Treasure",
      "Sculpture Treasure",
    ]);
  });

  it("keeps Scryfall's order within the same rank", () => {
    const ranked = rankTokenResults("goblin", [
      { name: "Goblin Shaman" },
      { name: "Goblin" },
      { name: "Goblin Rogue" },
    ]);
    expect(ranked.map((card) => card.name)).toEqual(["Goblin", "Goblin Shaman", "Goblin Rogue"]);
  });
});
