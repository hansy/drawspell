import { describe, expect, it } from "vitest";

import { getRequestedCounts, parseDeckList } from "@/services/deck-import/deckImport";
import {
  curatedDecks,
  FORMAT_TAG_ORDER,
  groupCuratedDecksByPrimaryTag,
  normalizeColorIdentity,
} from "../curatedDecks";

describe("curatedDecks", () => {
  it("keeps declared card counts in sync with decklist text", () => {
    curatedDecks.forEach((deck) => {
      const counts = getRequestedCounts(parseDeckList(deck.decklist));

      expect(counts.total, deck.name).toBe(deck.cardCount);
    });
  });

  it("keeps commander sections within Drawspell commander zone capacity", () => {
    curatedDecks
      .filter((deck) => deck.primaryFormatTag === "commander")
      .forEach((deck) => {
        const counts = getRequestedCounts(parseDeckList(deck.decklist));

        expect(counts.commander, deck.name).toBeGreaterThan(0);
        expect(counts.commander, deck.name).toBeLessThanOrEqual(2);
      });
  });

  it("tracks Moxfield source URLs for commander decks", () => {
    curatedDecks
      .filter((deck) => deck.primaryFormatTag === "commander")
      .forEach((deck) => {
        expect(deck.sourceUrl, deck.name).toMatch(/^https:\/\/moxfield\.com\/decks\//);
        expect(deck.backgroundImageUrl, deck.name).toMatch(
          /^https:\/\/cards\.scryfall\.io\/art_crop\//
        );
      });
  });

  it("does not use the standard tag for starter decks", () => {
    curatedDecks
      .filter((deck) => deck.primaryFormatTag === "starter")
      .forEach((deck) => {
        expect(deck.formatTags, deck.name).not.toContain("standard");
      });
  });

  it("has stable ids and required picker metadata", () => {
    const ids = new Set<string>();

    curatedDecks.forEach((deck) => {
      expect(ids.has(deck.id), deck.id).toBe(false);
      ids.add(deck.id);
      expect(deck.name.trim(), deck.id).not.toBe("");
      expect(deck.productName.trim(), deck.id).not.toBe("");
      expect(deck.description.trim(), deck.id).not.toBe("");
      expect(deck.decklist.trim(), deck.id).not.toBe("");
      expect(deck.formatTags, deck.id).toContain(deck.primaryFormatTag);
      expect(deck.colorIdentity.length, deck.id).toBeGreaterThan(0);
    });
  });

  it("groups decks by primary tag in configured order", () => {
    const groups = groupCuratedDecksByPrimaryTag(curatedDecks);
    const orderIndexes = groups.map((group) => FORMAT_TAG_ORDER.indexOf(group.tag));

    expect(orderIndexes).toEqual([...orderIndexes].sort((a, b) => a - b));
    expect(groups[0]?.tag).toBe("commander");
    expect(groups[1]?.tag).toBe("starter");
  });

  it("normalizes color identity in WUBRGC order", () => {
    expect(normalizeColorIdentity(["G", "W", "C", "W", "B"])).toEqual([
      "W",
      "B",
      "G",
      "C",
    ]);
  });
});
