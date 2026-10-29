// Archidekt deck links (https://archidekt.com/decks/123456/name) are turned into
// the plain decklist text the importer already understands.

const ARCHIDEKT_DECK_URL = /^\s*(?:https?:\/\/)?(?:www\.)?archidekt\.com\/(?:api\/)?decks\/(\d{1,12})(?:[/?#][^\s]*)?\s*$/i;

export const parseArchidektDeckId = (text: string): string | null =>
  ARCHIDEKT_DECK_URL.exec(text)?.[1] ?? null;

type ArchidektCategory = {
  name: string;
  includedInDeck?: boolean;
  isPremier?: boolean;
};

type ArchidektCard = {
  quantity?: number;
  categories?: string[] | null;
  deletedAt?: string | null;
  card?: { oracleCard?: { name?: string } };
};

export type ArchidektDeck = {
  name?: string;
  categories?: ArchidektCategory[];
  cards?: ArchidektCard[];
};

export const archidektDeckToDecklist = (deck: ArchidektDeck): string => {
  const categories = new Map(
    (deck.categories ?? []).map((category) => [category.name, category]),
  );
  const commander: string[] = [];
  const main: string[] = [];
  const sideboard: string[] = [];

  for (const entry of deck.cards ?? []) {
    const name = entry.card?.oracleCard?.name?.trim();
    const quantity = entry.quantity ?? 0;
    if (!name || quantity <= 0 || entry.deletedAt) continue;
    const cardCategories = (entry.categories ?? [])
      .map((categoryName) => categories.get(categoryName))
      .filter((category): category is ArchidektCategory => Boolean(category));
    // Maybeboard-style categories are kept on Archidekt but are not part of the deck.
    if (cardCategories.some((category) => category.includedInDeck === false)) continue;
    const line = `${quantity} ${name}`;
    if (cardCategories.some((category) => category.isPremier)) commander.push(line);
    else if (cardCategories.some((category) => category.name === "Sideboard")) sideboard.push(line);
    else main.push(line);
  }

  return [
    commander.length ? `Commander:\n${commander.join("\n")}` : "",
    `Deck:\n${main.join("\n")}`,
    sideboard.length ? `Sideboard:\n${sideboard.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};
