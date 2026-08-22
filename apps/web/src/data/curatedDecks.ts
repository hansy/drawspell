export type FormatTag = "commander" | "starter" | "standard";
export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

export type CuratedDeck = {
  id: string;
  name: string;
  productName: string;
  sourceUrl?: string;
  backgroundImageUrl?: string;
  primaryFormatTag: FormatTag;
  formatTags: FormatTag[];
  colorIdentity: ManaColor[];
  cardCount: number;
  description: string;
  sortDate: string;
  decklist: string;
};

export const FORMAT_TAG_LABELS: Record<FormatTag, string> = {
  commander: "Commander",
  starter: "Starter",
  standard: "Standard",
};

export const FORMAT_TAG_ORDER: FormatTag[] = ["commander", "starter", "standard"];
export const MANA_COLOR_ORDER: ManaColor[] = ["W", "U", "B", "R", "G", "C"];

export const normalizeColorIdentity = (colors: readonly ManaColor[]): ManaColor[] => {
  const unique = new Set(colors);
  return MANA_COLOR_ORDER.filter((color) => unique.has(color));
};

export const groupCuratedDecksByPrimaryTag = (decks: readonly CuratedDeck[]) =>
  FORMAT_TAG_ORDER.map((tag) => ({
    tag,
    label: FORMAT_TAG_LABELS[tag],
    decks: decks
      .filter((deck) => deck.primaryFormatTag === tag)
      .slice()
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.name.localeCompare(b.name)),
  })).filter((group) => group.decks.length > 0);

const HOBBIT_WELCOME_DECKS_URL =
  "https://magic.wizards.com/en/news/announcements/the-hobbit-welcome-decks";

export const curatedDecks: CuratedDeck[] = [
  {
    id: "hob-welcome-white",
    name: "White Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["W"],
    cardCount: 40,
    description: "Dwarves, riders, and protective white magic.",
    sortDate: "2026-08-14",
    decklist: `16 Plains
2 Dwarven Provisioner
Velvetwing Butterflies
2 Magnificent End
Mentor of the Meek
Fiend Hunter
2 Errand-Rider of Gondor
Landroval, Horizon Witness
Rogue's Passage
2 Soldier of the Grey Host
Eagles of the North
Dúnedain Blade
Fog on the Barrow-Downs
Eagle of the Great Shelf
Banishing Light
Dawn of a New Age
Vow to Erebor
2 Westfold Rider
Esquire of the King
Bofur, Reliable Guardian`,
  },
  {
    id: "hob-welcome-blue",
    name: "Blue Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["U"],
    cardCount: 40,
    description: "Bilbo's tricks, card draw, and evasive creatures.",
    sortDate: "2026-08-14",
    decklist: `16 Island
2 Bilbo Baggins, Burglar
Pelargir Survivor
2 Lakeshore Apothecary
Confusticate and Bebother
Ravenhill Flock
Lórien Revealed
Thranduil's Decree
Knights of Dol Amroth
Grey Havens Navigator
Rogue's Passage
2 Ithilien Kingfisher
Hithlain Knots
Captain of Umbar
Minas Tirith Garrison
Colossal Whale
Willow-Wind
Bilbo, Luckwearer
2 Uneasy Partings
Nimrodel Watcher
Stern Scolding`,
  },
  {
    id: "hob-welcome-black",
    name: "Black Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["B"],
    cardCount: 40,
    description: "Gollum, Goblins, and ruthless removal.",
    sortDate: "2026-08-14",
    decklist: `16 Swamp
2 Front Porch Sentries
Great Fierce Bee
Stir Up Trouble
Haunt of the Dead Marshes
Desolation Prowler
Ravening Warg
2 Gollum, Silent Slinker
2 Bilbo's Deadly Slice
Dreaded Bat-Cloud
Rogue's Passage
Crude Bent Blade
Languish
Shadow of the Enemy
Gollum the Abandoned
Gnashing of Teeth
Troll of Khazad-dûm
Merciless Executioner
Bitter Downfall
Reverent Howl
Night's Whisper
Stony-Voiced Goblins`,
  },
  {
    id: "hob-welcome-red",
    name: "Red Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["R"],
    cardCount: 40,
    description: "Goblins, burn spells, and Smaug's fire.",
    sortDate: "2026-08-14",
    decklist: `16 Mountain
2 Wayfarer's Bauble
2 Battle-Scarred Goblin
Improvised Club
2 Smaug, the Great Calamity
2 Olog-hai Crusher
Gandalf, Spark Starter
2 Ragged Short Spear
2 Smite the Deathless
2 Goblin Fireleaper
Oliphaunt
Rogue's Passage
Goblin Cratermaker
Inferno Titan
Guttersnipe
Orcish Siegemaster
Snowslope Hunter
Fire of Orthanc`,
  },
  {
    id: "hob-welcome-green",
    name: "Green Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["G"],
    cardCount: 40,
    description: "Elves, forest guidance, and growing creatures.",
    sortDate: "2026-08-14",
    decklist: `16 Forest
2 Guardian of the Halls
2 Quarrel
2 Galadhrim Guide
Galion, Elvenking's Butler
Elvish Visionary
Warg Tactics
Beorn's Hospitality
Rogue's Passage
Mirkwood Elk
Celeborn the Wise
Gift of Strands
Elvish Archdruid
Lothlórien Lookout
Woodland Weavemaster
Mirkwood Pathmaker
Beorn, Reluctant Host
2 Wood Elves
2 Elvish Mystic
Attercop`,
  },
];
