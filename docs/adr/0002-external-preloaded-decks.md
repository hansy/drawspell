# External Preloaded Decks and Bracket Tiers

External sites may submit optional per-player deck lists and their Bracket Tiers through Drawspell's authenticated room-creation API. Drawspell will store the submitted data with the Room and use it for the player's initial Deck Import, rather than asking the joining browser to retrieve trusted data from the external site. This preserves the submitted list and rating together and avoids requiring the external service to be available at join time; the external site is responsible for producing the rating, and Drawspell does not independently verify the assessment.

Players may subsequently replace their decks. Every successful Deck Import, including an initial preload, will produce the ordinary server-authored Game Log Event “<player> loaded a deck” in all Rooms. Deck locking, mismatch detection, and automatic bracket invalidation are outside this decision. Bracket Tiers are stored but will not be displayed in the initial version.

The [agreed API contract](../features/public-room-api-contract.md) records invitation behavior and the implementation sequence. This decision records the agreed data ownership and deck-swapping behavior; implementation was subsequently authorized by the user.

Room creation only checks request structure and input bounds; it does not resolve card names or return per-player deck errors. Card resolution remains in the normal client-side Deck Import. If automatic import fails, the player remains in the Room with the supplied list in the ordinary import screen and can correct or replace it.

The integrity guarantee covers the stored API-submitted deck list and Bracket Tier. It does not prove that browser-submitted cards match the list: the user explicitly chose to retain ordinary client-side Deck Import without additional server-side deck-content verification. This keeps the feature lightweight and consistent with freely replacing decks. The actual imported deck must not be advertised as tamper-proof.
