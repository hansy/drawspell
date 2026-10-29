import React from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { Minus, Plus } from "lucide-react";
import { normalizeCounterType } from "@mtg/shared/counters";

import { ZONE } from "@/constants/zones";
import {
  getDisplayPower,
  getDisplayToughness,
  shouldShowZonePowerToughness,
} from "@/lib/cardDisplay";
import { getNextCardStatUpdate, type CardStatKey } from "@/lib/cardPT";
import { PRESET_COUNTERS, findGlobalCounterKey, resolveCounterColor } from "@/lib/counters";
import { cn } from "@/lib/utils";
import { useCardEditHudStore } from "@/store/cardEditHudStore";
import { useDragStore } from "@/store/dragStore";
import { useGameStore } from "@/store/gameStore";

const stepButtonClassName =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70";

const Stepper: React.FC<{
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  children: React.ReactNode;
}> = ({ label, onDecrement, onIncrement, children }) => (
  <div className="flex items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-900 p-0.5">
    <button
      type="button"
      aria-label={`Remove one ${label}`}
      className={stepButtonClassName}
      onClick={onDecrement}
    >
      <Minus size={12} />
    </button>
    {children}
    <button
      type="button"
      aria-label={`Add one ${label}`}
      className={stepButtonClassName}
      onClick={onIncrement}
    >
      <Plus size={12} />
    </button>
  </div>
);

// On-card controls for the battlefield card you control under the pointer:
// colour-coded counters with -/+, power and toughness steppers, and a counter
// picker. It sits on the card's edge at a fixed size, so it stays usable at any zoom.
export const CardEditHud: React.FC = () => {
  const { cardId, anchor, pinned, cancelClose, requestClose, close } = useCardEditHudStore();
  const card = useGameStore((state) => (cardId ? state.cards[cardId] : undefined));
  const zoneType = useGameStore((state) =>
    card ? state.zones[card.zoneId]?.type : undefined,
  );
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const viewerRole = useGameStore((state) => state.viewerRole);
  const globalCounters = useGameStore((state) => state.globalCounters);
  const addCounterToCard = useGameStore((state) => state.addCounterToCard);
  const removeCounterFromCard = useGameStore((state) => state.removeCounterFromCard);
  const addGlobalCounter = useGameStore((state) => state.addGlobalCounter);
  const updateCard = useGameStore((state) => state.updateCard);
  const isDragging = useDragStore((state) => Boolean(state.activeCardId));
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const { refs, floatingStyles } = useFloating({
    open: Boolean(cardId && anchor),
    placement: "right-start",
    strategy: "fixed",
    elements: { reference: anchor },
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  React.useEffect(() => {
    setPickerOpen(false);
    setQuery("");
  }, [cardId]);

  React.useEffect(() => {
    if (isDragging) close();
  }, [isDragging, close]);

  React.useEffect(() => {
    if (!cardId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      if (pinned || pickerOpen) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, cardId, close, pickerOpen, pinned]);

  const editable =
    Boolean(card && anchor?.isConnected) &&
    zoneType === ZONE.BATTLEFIELD &&
    card?.controllerId === myPlayerId &&
    viewerRole !== "spectator" &&
    !isDragging;
  if (!editable || !card) return null;

  const counters = card.counters.filter((counter) => counter.count > 0);
  const counterColor = (type: string, color?: string) =>
    color || resolveCounterColor(type, globalCounters);
  const addCounter = (type: string, color?: string) => {
    const resolvedColor = counterColor(type, color);
    addCounterToCard(card.id, { type, count: 1, color: resolvedColor });
    if (!findGlobalCounterKey(globalCounters, type)) addGlobalCounter(type, resolvedColor);
  };

  const showPT = shouldShowZonePowerToughness(card, zoneType, { faceDown: card.faceDown });
  const changeStat = (stat: CardStatKey, delta: number) => {
    const update = getNextCardStatUpdate(card, stat, delta);
    if (update) updateCard(card.id, update);
  };

  const onCard = new Set(counters.map((counter) => normalizeCounterType(counter.type)));
  const options = Array.from(
    new Map(
      [...PRESET_COUNTERS.map((preset) => preset.type), ...Object.keys(globalCounters)]
        .filter((type) => !onCard.has(normalizeCounterType(type)))
        .map((type) => [normalizeCounterType(type), type] as const),
    ).values(),
  ).filter((type) => type.toLowerCase().includes(query.trim().toLowerCase()));
  const trimmedQuery = query.trim();
  const canCreate =
    trimmedQuery.length > 0 &&
    !options.some((type) => normalizeCounterType(type) === normalizeCounterType(trimmedQuery)) &&
    !onCard.has(normalizeCounterType(trimmedQuery));

  return (
    <FloatingPortal>
      <div
        ref={(node) => {
          rootRef.current = node;
          refs.setFloating(node);
        }}
        data-card-edit-hud={card.id}
        role="group"
        aria-label={`Edit ${card.name}`}
        style={floatingStyles}
        className="z-[60] flex w-max flex-col items-start gap-1 rounded-lg border border-zinc-700 bg-zinc-950/95 p-1 text-xs text-zinc-100 shadow-xl"
        onMouseEnter={cancelClose}
        onMouseLeave={() => requestClose(card.id)}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {counters.map((counter) => (
          <Stepper
            key={counter.type}
            label={`${counter.type} counter`}
            onDecrement={() => removeCounterFromCard(card.id, counter.type)}
            onIncrement={() => addCounter(counter.type, counter.color)}
          >
            <span
              title={counter.type}
              data-card-edit-hud-counter={counter.type}
              className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
              style={{ backgroundColor: counterColor(counter.type, counter.color) }}
            >
              {counter.count}
            </span>
          </Stepper>
        ))}

        {showPT && (
          <div className="flex items-center gap-1" data-card-edit-hud-pt>
            <Stepper
              label="power"
              onDecrement={() => changeStat("power", -1)}
              onIncrement={() => changeStat("power", 1)}
            >
              <span title="Power" className="min-w-5 text-center font-mono text-[11px] font-semibold">
                {getDisplayPower(card) ?? "–"}
              </span>
            </Stepper>
            <Stepper
              label="toughness"
              onDecrement={() => changeStat("toughness", -1)}
              onIncrement={() => changeStat("toughness", 1)}
            >
              <span title="Toughness" className="min-w-5 text-center font-mono text-[11px] font-semibold">
                {getDisplayToughness(card) ?? "–"}
              </span>
            </Stepper>
          </div>
        )}

        {pickerOpen ? (
          <div className="flex w-40 flex-col gap-0.5" data-card-edit-hud-picker>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const pick = canCreate ? trimmedQuery : options[0];
                  if (pick) {
                    addCounter(pick);
                    setPickerOpen(false);
                    setQuery("");
                  }
                }
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setPickerOpen(false);
                }
              }}
              placeholder="Counter name"
              aria-label="Counter name"
              className="h-7 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[12px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex max-h-40 flex-col overflow-y-auto">
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    addCounter(trimmedQuery);
                    setPickerOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-800"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: resolveCounterColor(trimmedQuery, globalCounters) }}
                  />
                  Add “{trimmedQuery}”
                </button>
              )}
              {options.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    addCounter(type);
                    setPickerOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-800"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: resolveCounterColor(type, globalCounters) }}
                  />
                  {type}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Add a counter"
            title="Add a counter"
            onClick={() => setPickerOpen(true)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-500 text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
            )}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </FloatingPortal>
  );
};
