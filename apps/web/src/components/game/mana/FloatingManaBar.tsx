import React from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MAX_FLOATING_MANA_PER_TYPE,
  MANA_TYPES,
  normalizeManaPool,
  type ManaPool,
  type ManaType,
} from "@/types";

const MANA_NAMES: Record<ManaType, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  C: "Colorless",
};

const MANA_GLOW: Record<ManaType, string> = {
  W: "hover:drop-shadow-[0_0_5px_rgba(255,251,214,0.8)]",
  U: "hover:drop-shadow-[0_0_5px_rgba(100,181,246,0.8)]",
  B: "hover:drop-shadow-[0_0_5px_rgba(185,154,204,0.65)]",
  R: "hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]",
  G: "hover:drop-shadow-[0_0_5px_rgba(74,222,128,0.75)]",
  C: "hover:drop-shadow-[0_0_5px_rgba(212,212,216,0.65)]",
};

const MANA_SURFACE: Record<ManaType, string> = {
  W: "border-[#f4efcf] bg-[#d8cc98]",
  U: "border-[#56a8d8] bg-[#287dab]",
  B: "border-[#76647f] bg-[#46394b]",
  R: "border-[#d96850] bg-[#a74633]",
  G: "border-[#469568] bg-[#2d754d]",
  C: "border-[#aaa9a6] bg-[#666562]",
};

type ManaOrbProps = {
  manaType: ManaType;
  amount: number;
  editable: boolean;
  open: boolean;
  pinned: boolean;
  onHoverOpenChange: (open: boolean) => void;
  onPinnedChange: (pinned: boolean) => void;
  onAdjust?: (manaType: ManaType, delta: -1 | 1) => void;
};

const ManaOrb: React.FC<ManaOrbProps> = ({
  manaType,
  amount,
  editable,
  open,
  pinned,
  onHoverOpenChange,
  onPinnedChange,
  onAdjust,
}) => {
  const lastPointerTypeRef = React.useRef<string | null>(null);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (nextOpen) => {
      if (!pinned) onHoverOpenChange(nextOpen);
    },
    placement: "top",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const hover = useHover(context, {
    enabled: editable && !pinned,
    mouseOnly: true,
    delay: { close: 80 },
    handleClose: safePolygon({ blockPointerEvents: true }),
  });
  const focus = useFocus(context, { enabled: editable && !pinned });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        {...getReferenceProps({
          className: cn(
            "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border outline-none",
            "transition-[filter,transform] hover:scale-105 focus-visible:ring-2 focus-visible:ring-indigo-300/80",
            MANA_SURFACE[manaType],
            MANA_GLOW[manaType],
          ),
          onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
            lastPointerTypeRef.current = event.pointerType;
          },
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            if (!editable) return;
            const pointerType = lastPointerTypeRef.current;
            lastPointerTypeRef.current = null;
            if (
              pointerType === "touch" ||
              pointerType === "pen" ||
              event.detail === 0
            ) {
              onPinnedChange(!pinned);
            }
          },
          disabled: !editable,
          "aria-label": `${MANA_NAMES[manaType]} mana: ${amount}${editable ? ". Open controls" : ""}`,
          "aria-expanded": editable ? open : undefined,
        })}
      >
        <span
          aria-hidden="true"
          data-mana-count={amount}
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(9,9,11,0.9)_0%,rgba(9,9,11,0.72)_27%,rgba(9,9,11,0.18)_53%,transparent_72%)]"
        >
          <span className="flex min-w-[15px] items-center justify-center px-0.5 font-mono text-[10px] font-black leading-none text-white [text-shadow:0_1px_2px_#000,0_0_4px_#000,0_0_7px_#000]">
            {amount}
          </span>
        </span>
      </button>

      {open && editable && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-floating-mana-stepper={manaType}
            className="pointer-events-auto z-[10000] flex h-8 items-center gap-1 rounded-full border border-zinc-600/90 bg-zinc-950/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            role="group"
            aria-label={`${MANA_NAMES[manaType]} mana controls`}
            style={floatingStyles}
          >
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 disabled:opacity-30"
              onClick={() => onAdjust?.(manaType, -1)}
              disabled={amount <= 0}
              aria-label={`Remove one ${MANA_NAMES[manaType].toLowerCase()} mana`}
            >
              <Minus size={13} strokeWidth={2.5} />
            </button>
            <span className="min-w-5 text-center font-mono text-xs font-bold text-zinc-100">
              {amount}
            </span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 disabled:opacity-30"
              onClick={() => onAdjust?.(manaType, 1)}
              disabled={amount >= MAX_FLOATING_MANA_PER_TYPE}
              aria-label={`Add one ${MANA_NAMES[manaType].toLowerCase()} mana`}
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

export type FloatingManaBarProps = {
  manaPool?: ManaPool;
  editable: boolean;
  onAdjust?: (manaType: ManaType, delta: -1 | 1) => void;
  onClear?: () => void;
  className?: string;
};

export const FloatingManaBar: React.FC<FloatingManaBarProps> = ({
  manaPool: manaPoolInput,
  editable,
  onAdjust,
  onClear,
  className,
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [hoveredMana, setHoveredMana] = React.useState<ManaType | null>(null);
  const [pinnedMana, setPinnedMana] = React.useState<ManaType | null>(null);
  const manaPool = React.useMemo(
    () => normalizeManaPool(manaPoolInput),
    [manaPoolInput],
  );
  const total = MANA_TYPES.reduce(
    (sum, manaType) => sum + (manaPool[manaType] ?? 0),
    0,
  );

  React.useEffect(() => {
    if (!pinnedMana) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (rootRef.current?.contains(target)) return;
      if (target?.closest("[data-floating-mana-stepper]")) return;
      setPinnedMana(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinnedMana(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [pinnedMana]);

  return (
    <div
      ref={rootRef}
      data-floating-mana-bar
      className={cn(
        "pointer-events-auto flex h-8 min-w-0 items-center justify-end gap-1.5",
        className,
      )}
      data-no-seat-swipe="true"
      aria-label={editable ? "Floating mana controls" : "Floating mana"}
    >
      {MANA_TYPES.map((manaType) => (
        <ManaOrb
          key={manaType}
          manaType={manaType}
          amount={manaPool[manaType] ?? 0}
          editable={editable}
          open={editable && (pinnedMana ?? hoveredMana) === manaType}
          pinned={pinnedMana === manaType}
          onHoverOpenChange={(open) =>
            setHoveredMana(open ? manaType : null)
          }
          onPinnedChange={(pinned) => {
            setHoveredMana(null);
            setPinnedMana(pinned ? manaType : null);
          }}
          onAdjust={onAdjust}
        />
      ))}
      <div
        data-floating-mana-clear-slot
        className="ml-0.5 flex w-9 shrink-0 items-center justify-center"
      >
        {editable && (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-[10px] font-semibold tracking-wide text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 disabled:cursor-default disabled:text-zinc-500"
            onClick={onClear}
            disabled={total === 0}
            aria-label="Clear all floating mana"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
