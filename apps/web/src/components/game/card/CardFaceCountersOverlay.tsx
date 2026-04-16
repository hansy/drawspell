import React from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { CardFaceCounterModel } from "@/models/game/card/cardFaceModel";

export const CardFaceCountersOverlay: React.FC<{
  counters: CardFaceCounterModel[];
  countersClassName?: string;
  interactive?: boolean;
  showCounterLabels?: boolean;
  revealInteractiveCounterControls?: boolean;
  onIncrementCounter?: (counter: Pick<CardFaceCounterModel, "type" | "color">) => void;
  onDecrementCounter?: (counterType: string) => void;
  customTextNode?: React.ReactNode;
  customTextPosition?: "sidebar" | "bottom-left" | "center";
}> = ({
  counters,
  countersClassName,
  interactive,
  showCounterLabels,
  revealInteractiveCounterControls,
  onIncrementCounter,
  onDecrementCounter,
  customTextNode,
  customTextPosition,
}) => {
  const showSidebarCustomText = customTextNode && customTextPosition === "sidebar";
  const shouldAlwaysShowCounterControls =
    Boolean(interactive) && Boolean(revealInteractiveCounterControls);
  if (counters.length === 0 && !showSidebarCustomText) return null;

  const counterButtonClassName = (visible: boolean) =>
    cn(
      "w-5 h-5 flex items-center justify-center rounded text-white text-xs border border-zinc-600 transition-opacity",
      visible
        ? "bg-zinc-800 hover:bg-zinc-700 opacity-100 pointer-events-auto"
        : "bg-zinc-800 hover:bg-zinc-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
    );

  return (
    <div
      className={cn(
        "absolute top-0 right-0 flex flex-col gap-1 items-end pr-1 pt-1",
        countersClassName
      )}
    >
      {counters.map((counter) => {
        if (showCounterLabels) {
          return (
            <div
              key={counter.type}
              className="group relative flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-white shadow-md"
              style={{ backgroundColor: counter.renderColor }}
            >
              {interactive && (
                <button
                  type="button"
                  aria-label={`Decrement ${counter.type} counter`}
                  className={cn(
                    counterButtonClassName(
                      shouldAlwaysShowCounterControls,
                    ),
                    "absolute right-full top-1/2 -translate-y-1/2 mr-1",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDecrementCounter?.(counter.type);
                  }}
                >
                  -
                </button>
              )}
              {counter.count}
              <div className="absolute left-full top-1/2 z-50 flex h-6 -translate-y-1/2 items-center gap-1 pl-1">
                {interactive && (
                  <button
                    type="button"
                    aria-label={`Increment ${counter.type} counter`}
                    className={counterButtonClassName(
                      shouldAlwaysShowCounterControls,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrementCounter?.(counter);
                    }}
                  >
                    +
                  </button>
                )}
                <div
                  className={cn(
                    "whitespace-nowrap rounded border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-xs text-zinc-100 shadow-lg",
                    shouldAlwaysShowCounterControls
                      ? "pointer-events-auto"
                      : "pointer-events-none group-hover:pointer-events-auto",
                  )}
                >
                  {counter.type}
                </div>
              </div>
            </div>
          );
        }

        const counterBadge = (
          <div
            className="group relative flex items-center justify-center w-6 h-6 rounded-full shadow-md border border-white/20 text-white text-[10px] font-bold cursor-help transition-all hover:z-50"
            style={{ backgroundColor: counter.renderColor }}
          >
            {counter.count}
          </div>
        );

        return (
          <Tooltip key={counter.type} content={counter.type} placement="left">
            {counterBadge}
          </Tooltip>
        );
      })}

      {/* Sidebar Custom Text */}
      {showSidebarCustomText && (
        <div className="relative w-6 h-0 flex items-center justify-center">
          <div className="absolute left-full pl-2 top-0">{customTextNode}</div>
        </div>
      )}
    </div>
  );
};
