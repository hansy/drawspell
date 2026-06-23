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
    id: "msh-welcome-white",
    name: "White Welcome Deck",
    productName: "Marvel Super Heroes Welcome Deck",
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["W"],
    cardCount: 30,
    description: "A white 30-card starter half-deck.",
    sortDate: "2026-06-26",
    decklist: `13 Plains
2 Virtuous Variant
Doctor Jane Foster
2 Brave Brawler
Fall to Earth
Raft Security Officer
Peggy Carter, Secret Agent
Vibranium Energy Daggers
Luke Cage, Power Man
Valkyrior Skyrider
Black Panther, Claws of Bast
Mockingbird, Bobbi Morse
Take Up the Shield
Web Up
Selfless Police Captain
Crowd of True Believers`,
  },
  {
    id: "msh-welcome-blue",
    name: "Blue Welcome Deck",
    productName: "Marvel Super Heroes Welcome Deck",
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["U"],
    cardCount: 30,
    description: "A blue 30-card starter half-deck.",
    sortDate: "2026-06-26",
    decklist: `13 Island
Mist-Cloaked Herald
2 TVA Bureaucrat
2 Aerial Doombot
Iron Lad, Diverging Destiny
Futurist Forge
Lyla, Holographic Assistant
Blue Marvel, Adam Brashear
2 Alchemax Slayer-Bots
Whoosh!
Iron Man, Modern Marvel
Ant-Man's Air Force
A.I.M. Scientists
I Am Iron Man
Depower`,
  },
  {
    id: "msh-welcome-black",
    name: "Black Welcome Deck",
    productName: "Marvel Super Heroes Welcome Deck",
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["B"],
    cardCount: 30,
    description: "A black 30-card starter half-deck.",
    sortDate: "2026-06-26",
    decklist: `13 Swamp
2 Songbird, Sonic Screamer
2 Symbiote Spawn
2 Glamorous Grapplers
Infernal Rebirth
2 Red Room Recruit
Ultimo, Civilization’s End
Dark Deed
Tombstone, Career Criminal
Hour of Defeat
Unliving Legionnaire
Black Widow, Daring Operative
Widow's Bite
Doom Blade`,
  },
  {
    id: "msh-welcome-red",
    name: "Red Welcome Deck",
    productName: "Marvel Super Heroes Welcome Deck",
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["R"],
    cardCount: 30,
    description: "A red 30-card starter half-deck.",
    sortDate: "2026-06-26",
    decklist: `13 Mountain
2 Rampaging Classmate
2 Extremis Elite
Human Torch, Johnny Storm
Kree Sentinel
Sif's Spearmaster
Misty Knight, Hero for Hire
Furious Strength
Spider-Man, Web-Spinner
Marvelous Melee
Living Lightning, Charged Up
The Mary Janes
Smashing Spree
Quicksilver, Pietro Maximoff
Lightning Strike
Happy Hogan, Dauntless Driver`,
  },
  {
    id: "msh-welcome-green",
    name: "Green Welcome Deck",
    productName: "Marvel Super Heroes Welcome Deck",
    primaryFormatTag: "starter",
    formatTags: ["starter"],
    colorIdentity: ["G"],
    cardCount: 30,
    description: "A green 30-card starter half-deck.",
    sortDate: "2026-06-26",
    decklist: `13 Forest
2 The Fabulous Frog-Man
2 Undercover Skrull
She-Hulk, Jade Defender
Savage Land Dinosaur
Wakandan Royal Guard
Kapow!
Goliath, Mass Manipulator
Wolfsbane, Highland Hero
Super Strength
Mister Hyde, Monster Within
Warriors of Wakanda
Giant Growth
Thing Swing
Hulk, Brutal Brawler
Knight of Wundagore`,
  },
];
