import { detectSectionHeader, isIgnoredHeader, type DeckSection } from "./decklistParsing";
import { parseDecklistCardLine } from "./cardLineParsing";
import type { ParsedCard } from "./types";

const buildCard = (
  quantity: number,
  name: string,
  section: DeckSection,
  set = "",
  collectorNumber = ""
): ParsedCard => ({
  quantity,
  name,
  set,
  collectorNumber,
  section,
});

export const parseDeckList = (text: string): ParsedCard[] => {
  const lines = text.split("\n");
  const cards: ParsedCard[] = [];
  let currentSection: DeckSection = "main";

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === "") continue;

    // Detect Section Headers
    const header = detectSectionHeader(trimmedLine);
    if (header) {
      currentSection = header;
      continue;
    }

    if (isIgnoredHeader(trimmedLine)) continue;

    const card = parseDecklistCardLine(trimmedLine);
    if (!card) continue;

    cards.push(
      buildCard(
        card.quantity,
        card.name,
        currentSection,
        card.set,
        card.collectorNumber
      )
    );
  }

  return cards;
};
