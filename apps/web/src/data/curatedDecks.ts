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
    id: "msh-avengers-assemble",
    name: "Avengers Assemble",
    productName: "Marvel Super Heroes Commander",
    sourceUrl: "https://moxfield.com/decks/VnAdVaM_b0u66KIAZCLI8A",
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/6/1/61a51b67-d941-4e07-9c12-ffe583cb65d4.jpg?1780413188",
    primaryFormatTag: "commander",
    formatTags: ["commander"],
    colorIdentity: ["W", "U", "R"],
    cardCount: 100,
    description: "Hero creatures and team-wide counters.",
    sortDate: "2026-06-26",
    decklist: `Commander:
Captain America, Team Leader

Deck:
Avenge
Falcon and Redwing
Hercules, Olympian Hero
Heroic Return
Heroic Sacrifice
Methods of the Mighty
Winter Soldier, Reborn Avenger
Iron Man, Armored Avenger
Jarvis, Earth's Mightiest Butler
Professor Hulk
The Wasp, Winsome Avenger
West Coast Expansion
Firebird, Blazing Ranger
Photon, Mighty Marvel
She-Hulk, Wallbreaker
War Machine, Avenging Arsenal
Ant-Man, Elusive Avenger
Black Widow, Agile Avenger
Captain Marvel, Apex Avenger
Director Nick Fury
Hawkeye, Avenging Archer
Love on the Battlefield
Quicksilver, Speedster
Scarlet Witch, Chaotic Avenger
Shang-Chi and the Ten Rings
Avengers Quinjet
Hulkbuster Armor
Jocasta, Automaton Avenger
Vision, Synthezoid Avenger
Austere Command
Bastion Protector
Dismantling Wave
Folk Hero
Gift of Immortality
Kindred Discovery
Door of Destinies
Metallic Mimic
Tome of Legends
Clifftop Retreat
Coastal Peak
Exotic Orchard
Frostboil Snarl
Furycalm Snarl
Glacial Fortress
Glittering Massif
Irrigated Farmland
Plaza of Heroes
Port Town
Prairie Stream
Radiant Summit
Scavenger Grounds
Scorched Geyser
Spectator Seating
Sulfur Falls
Raise the Palisade
Thor, Asgard's Avenger
Captain Mar-Vell, Space-Born
Patriot, Shield Wielder
Speed, Young Avenger
Captain America, Living Legend
Avengers Tower
Destroy Evil
Make Your Move
Swords to Plowshares
Arcane Denial
Reconnaissance Mission
Rip Apart
Arcane Signet
Hero's Blade
Relic of Legends
Sol Ring
Talisman of Conviction
Talisman of Creativity
Talisman of Progress
Thought Vessel
Command Tower
Mystic Monastery
Path of Ancestry
Secluded Courtyard
Unclaimed Territory
Fellwar Stone
Herald's Horn
Rescue, Pepper Potts
6 Plains
5 Island
5 Mountain`,
  },
  {
    id: "msh-wakanda-forever",
    name: "Wakanda Forever",
    productName: "Marvel Super Heroes Commander",
    sourceUrl: "https://moxfield.com/decks/-73tFnDWzkaLqk6HWSxYsA",
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/c/1/c1c8ad61-b7e1-446c-8b74-6e29371ea1d5.jpg?1781500275",
    primaryFormatTag: "commander",
    formatTags: ["commander"],
    colorIdentity: ["W", "G"],
    cardCount: 100,
    description: "Artifacts, tokens, and Wakandan synergy.",
    sortDate: "2026-06-26",
    decklist: `Commander:
T'Challa, the Black Panther

Deck:
Dora Milaje Elite
Everett K. Ross, Hapless Attaché
Hatut Zeraze Strike Force
King Solomon's Frogs
Midnight Angel Armor
Queen Mother Ramonda
Royal Talon Fighter Jet
The Spear of Bashenga
Ancestral Communion
Fight for the Throne
M'Baku, Jabari Chieftain
Nakia, Wakandan Operative
W'Kabi, Shield of the Nation
Wakanda Forever!
Zuri, Warrior of Wakanda
Bast, Panther Goddess
Okoye, Mighty and Adored
Shuri, the Black Panther
Storm, Queen of Wakanda
T'Chaka, Venerable King
Heart-Shaped Herb
Kimoyo Beads
N'Yami-Class Mother Ship
Panther Habit
Panther Robot
Shuri's Fabricator
Vibranium Mining Mech
Vibranium Strike Gauntlets
The Great Mound
Divine Visitation
Loyal Retainers
Martial Coup
Vanquish the Horde
Birds of Paradise
Conduit of Worlds
Greater Good
Nature's Lore
Overwhelming Stampede
Coveted Jewel
Gilded Lotus
Helm of the Host
Metalwork Colossus
Solemn Simulacrum
Trading Post
Bountiful Promenade
Canopy Vista
Fortified Village
Razorverge Thicket
Scattered Groves
Scavenger Grounds
Sungrass Prairie
Sunpetal Grove
Throne of the High City
Scourglass
Fleecemane Lion
Hammer of Nazahn
Mind's Eye
Sword of the Animist
Thran Dynamo
Dispatch
Generous Gift
Ingenious Smith
Palace Jailer
Valorous Stance
Beast Within
Harmonize
Loyal Guardian
Arcane Signet
Meteor Golem
Sol Ring
Whispersilk Cloak
Command Tower
Evolving Wilds
Path of Ancestry
Terramorphic Expanse
12 Plains
12 Forest`,
  },
  {
    id: "msh-fantastic-four",
    name: "The Fantastic Four",
    productName: "Marvel Super Heroes Commander",
    sourceUrl: "https://moxfield.com/decks/AcieAXzKv36b-FyecCLBJA",
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/f/1/f1d80509-ece1-4b6d-bfe5-c6d003f581cf.jpg?1765294256",
    primaryFormatTag: "commander",
    formatTags: ["commander"],
    colorIdentity: ["W", "U", "R", "G"],
    cardCount: 100,
    description: "Four-color spells and Marvel's First Family.",
    sortDate: "2026-06-26",
    decklist: `Commander:
Mister Fantastic

Deck:
Invisible Woman
Human Torch
The Thing
Galactus, Devourer of Worlds
Silver Surfer, Galactus's Herald
Invisible Force Field
Ultimate Nullification
Council of Reeds
Fantastic Elasticity
Lockjaw, Slobbering Teleporter
Valeria Richards, Precocious
Alicia Masters, Skilled Sculptor
Flame On!
Franklin Richards, Ascendant
Nova Flame
It's Clobberin' Time!
Medusa, Inhuman Queen
Black Bolt, Inhuman King
Cosmic Crucible
Crystal, Inhuman Princess
Dragon Man, Reformed Robot
First Family
Namor, Atlantean King
Power Pack
Willie Lumpkin, Postman
The Fantasticar
H.E.R.B.I.E., Lovable Robot
Negative Zone Portal
Unstable Molecule Suit
Cleansing Nova
Clever Concealment
Collective Effort
Monologue Tax
Promise of Loyalty
Tragic Arrogance
Quantum Misalignment
Recurring Insight
Into the Time Vortex
Seize the Day
Path of Discovery
Galvanic Iteration
Taunt from the Rampart
Whirlwind of Thought
Chromatic Lantern
Mirage Mirror
Canopy Vista
Cinder Glade
Clifftop Retreat
Exotic Orchard
Fabled Passage
Glacial Fortress
Hinterland Harbor
Prairie Stream
Radiant Summit
Rejuvenating Springs
Rootbound Crag
Scorched Geyser
Sodden Verdure
Sulfur Falls
Sunpetal Grove
Terramorphic Expanse
Mind's Dilation
Annie Joins Up
Genesis Ultimatum
Mister Fantastic, Reed Richards
Baxter Building
Bovine Intervention
Cut a Deal
Path to Exile
Deep Analysis
Cultivate
Farseek
Terramorph
Three Visits
Expressive Iteration
Hull Breach
Arcane Signet
Lightning Greaves
Sol Ring
Command Tower
Evolving Wilds
Path of Ancestry
5 Plains
4 Island
3 Mountain
5 Forest`,
  },
  {
    id: "msh-doom-prevails",
    name: "Doom Prevails",
    productName: "Marvel Super Heroes Commander",
    sourceUrl: "https://moxfield.com/decks/mWQACuymy0OV-2MJgx2-TQ",
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/0/9/099ed408-9178-4403-8b2d-479ca3cbda9b.jpg?1780413198",
    primaryFormatTag: "commander",
    formatTags: ["commander"],
    colorIdentity: ["U", "B", "R"],
    cardCount: 100,
    description: "Villains, connive, and ruthless value.",
    sortDate: "2026-06-26",
    decklist: `Commander:
Doctor Doom, King of Latveria

Deck:
Molecule Man
Extract Power
Glorious Purpose
Helmut Zemo, Mastermind
Kang Dynasty
Age of Ultron
Damocles Base, Sword of Kang
Endless Ranks of HYDRA
The Frightful Four
Iron Monger, Sadistic Tycoon
Klaw, Master of Sound
Abomination, World Ravager
Batroc the Leaper
Killmonger, Ruthless Usurper
Lady Loki, Agent of Chaos
Living Laser
Loki's Scepter
Puppet Master, String Puller
Stilt-Man, Towering Terror
Titania, Proud Pummeler
Archnemesis
Kang Prime
Loki, the Deceiver
Red Ghost, Intangible Genius
The Squadron Sinister
Typhoid Mary, Fractured
Ultron, Unlimited
Doom's Time Platform
Tri-Sentinel, Act of Vengeance
Black Market Connections
Kindred Dominance
Lethal Scheme
Toxic Deluge
Blasphemous Act
Chaos Warp
Bedevil
Currency Converter
Progenitor's Icon
Skullclamp
Canyon Slough
Choked Estuary
Coastal Peak
Dragonskull Summit
Drowned Catacomb
Exotic Orchard
Fetid Pools
Foreboding Ruins
Frostboil Snarl
Luxury Suite
Scavenger Grounds
Scorched Geyser
Smoldering Marsh
Sulfur Falls
Sunken Hollow
Spark Double
Titan of Littjara
Baron Strucker, HYDRA Overlord
Moonstone, Harsh Mistress
Kang, Temporal Tyrant
Madame Hydra
Villainous Hideout
Containment Construct
Chameleon, Master of Disguise
Propaganda
Night's Whisper
Syphon Mind
Tombstone, Career Criminal
Withering Torment
Superior Foes of Spider-Man
Vandalblast
Prowler, Clawed Thief
Terminate
Arcane Signet
Patchwork Banner
Sol Ring
Swiftfoot Boots
Talisman of Dominance
Talisman of Indulgence
Command Tower
Crumbling Necropolis
Path of Ancestry
Secluded Courtyard
Terramorphic Expanse
Unclaimed Territory
4 Island
6 Swamp
5 Mountain`,
  },
  {
    id: "hob-welcome-white",
    name: "White Welcome Deck",
    productName: "The Hobbit Welcome Deck",
    sourceUrl: HOBBIT_WELCOME_DECKS_URL,
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/6/b/6b8e6435-7de4-41d5-bc7d-8e24c11897d0.jpg?1785496981",
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
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/8/b/8bff0aa6-16d9-4c83-b598-ef00a3b33d2c.jpg?1783902786",
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
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/6/c/6cfaa182-3fec-4907-8814-b4d29c33cec3.jpg?1785323234",
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
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/4/1/419ca9e5-8413-4378-a4ef-eda5a1024218.jpg?1785497136",
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
    backgroundImageUrl:
      "https://cards.scryfall.io/art_crop/front/8/0/804589b7-3ef9-473d-97cc-c61a2d41f70d.jpg?1785323267",
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
