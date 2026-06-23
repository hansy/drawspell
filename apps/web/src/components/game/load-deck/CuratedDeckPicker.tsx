import { ManaSymbols } from "../mana/ManaSymbols";
import { cn } from "@/lib/utils";
import {
  FORMAT_TAG_LABELS,
  groupCuratedDecksByPrimaryTag,
  type CuratedDeck,
} from "@/data/curatedDecks";

type CuratedDeckPickerProps = {
  decks: CuratedDeck[];
  activeDeckId: string | null;
  disabled: boolean;
  onSelectDeck: (deck: CuratedDeck) => void;
};

export const CuratedDeckPicker = ({
  decks,
  activeDeckId,
  disabled,
  onSelectDeck,
}: CuratedDeckPickerProps) => {
  const groups = groupCuratedDecksByPrimaryTag(decks);
  const orderedDecks = groups.flatMap((group) => group.decks);

  if (!groups.length) return null;

  return (
    <section
      aria-label="Curated decks"
      className="grid h-[min(18rem,42dvh)] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:h-64"
    >
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Curated Decks</h3>
      </div>

      <div className="grid min-h-0 content-start gap-3 overflow-y-auto px-0.5 pt-2 pr-1">
        {orderedDecks.map((deck) => {
          const isActive = activeDeckId === deck.id;
          return (
            <button
              key={deck.id}
              type="button"
              onClick={() => onSelectDeck(deck)}
              disabled={disabled}
              className={cn(
                "relative grid gap-1 overflow-visible rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-left transition hover:border-indigo-500/70 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
                isActive && "border-indigo-400 bg-indigo-950/30"
              )}
            >
              {deck.backgroundImageUrl && (
                <>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-md bg-cover bg-center opacity-50"
                    style={{ backgroundImage: `url(${deck.backgroundImageUrl})` }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-md bg-zinc-950/60"
                  />
                </>
              )}

              <span
                className={cn(
                  "absolute -top-2 left-3 z-10 rounded border bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal",
                  deck.primaryFormatTag === "commander"
                    ? "border-indigo-400/50 text-indigo-100"
                    : deck.primaryFormatTag === "starter"
                      ? "border-emerald-400/50 text-emerald-100"
                      : "border-amber-400/50 text-amber-100"
                )}
              >
                {FORMAT_TAG_LABELS[deck.primaryFormatTag]}
              </span>

              <ManaSymbols
                colors={deck.colorIdentity}
                className="absolute -top-2 right-3 z-10 rounded-full bg-zinc-950 px-1 text-sm"
              />

              <div className="relative z-10 min-w-0 pr-1">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {deck.name}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{deck.productName}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
