# Curated Decks

Curated Decks are Drawspell-provided ready-to-import deck lists for players who
want to enter a Room without preparing a list first.

## Contract

- Curated Decks appear only on the Load Deck screen.
- The normal Load Deck entry point remains hidden once the player has an imported
  deck.
- Deck Import rejects attempts to import when the target player already has an
  imported deck, regardless of entry point.
- Choosing a Curated Deck populates the Import Deck List.
- The player starts Deck Import by pressing Load Deck.
- If the Import Deck List has non-whitespace text, the player confirms before it
  is replaced.
- Choosing a Curated Deck does not overwrite the stored last user-provided
  Import Deck List. Pressing Load Deck stores the imported list as the latest
  user-provided Import Deck List.
- If import fails, the Curated Deck list remains visible in the textarea.

## Picker

- Curated Decks are grouped by primary Format Tag.
- `commander` decks render before `starter` decks.
- `starter` is used for onboarding decks such as 30-card Welcome Deck half-decks.
- `standard` is reserved for decks intended to represent the official Standard
  format.
- The picker shows each deck's format tag and mana symbols from the deck's
  stored color identity.

## Data

Curated Deck data is reviewed source code, not remote configuration. Each entry
stores the full deck-list text, product name, primary Format Tag, all Format
Tags, color identity, card count, and sorting date.

Commander Curated Decks include an explicit `Commander:` section so Drawspell can
place the intended primary commander in the Commander Zone. Alternate commanders
remain in the main deck unless a product explicitly uses co-commanders.
