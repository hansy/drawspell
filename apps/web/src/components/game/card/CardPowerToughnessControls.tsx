import React from "react";

import type { CardStatKey } from "@/lib/cardPT";
import { cn } from "@/lib/utils";

interface CardPowerToughnessControlsProps {
  displayPower?: string;
  displayToughness?: string;
  comparisonPower?: string;
  comparisonToughness?: string;
  canEdit: boolean;
  onDelta: (type: CardStatKey, delta: number) => void;
  className?: string;
}

const getStatClassName = (displayValue?: string, comparisonValue?: string) => {
  const displayNumber = Number.parseInt(displayValue || "0", 10);
  const comparisonNumber = Number.parseInt(comparisonValue || "0", 10);

  return cn(
    "text-xl font-bold leading-none text-center",
    displayNumber > comparisonNumber
      ? "text-green-500"
      : displayNumber < comparisonNumber
        ? "text-red-500"
        : "text-white",
  );
};

const statButtonClassName =
  "mx-auto flex h-[var(--pt-button-h)] w-[var(--pt-button-w)] items-center justify-center rounded bg-zinc-950/90 text-base font-bold text-white shadow-lg border border-zinc-700 hover:bg-zinc-800 active:bg-zinc-700";

const statGridClassName =
  "grid grid-cols-[var(--pt-col-w)_auto_var(--pt-col-w)] items-center gap-1";

export const CardPowerToughnessControls: React.FC<
  CardPowerToughnessControlsProps
> = ({
  displayPower,
  displayToughness,
  comparisonPower,
  comparisonToughness,
  canEdit,
  onDelta,
  className,
}) => (
  <div
    className={cn(
      "absolute bottom-0 left-full ml-2 z-50 flex min-w-max flex-col items-center gap-[var(--pt-row-gap)]",
      "[--pt-button-h:1.5rem] [--pt-button-w:2.25rem] [--pt-col-w:2.5rem] [--pt-row-gap:0.25rem] [--pt-value-px:0.5rem] [--pt-value-py:0.375rem]",
      "lg:[--pt-button-h:1.25rem] lg:[--pt-button-w:2rem] lg:[--pt-col-w:2.25rem] lg:[--pt-row-gap:0.125rem] lg:[--pt-value-py:0.25rem]",
      className,
    )}
    data-card-preview-pt
  >
    {canEdit && (
      <div className={statGridClassName} data-card-preview-pt-increments>
        <button
          className={statButtonClassName}
          aria-label="Increase power"
          onClick={(e) => {
            e.stopPropagation();
            onDelta("power", 1);
          }}
          type="button"
        >
          +
        </button>
        <span aria-hidden="true" />
        <button
          className={statButtonClassName}
          aria-label="Increase toughness"
          onClick={(e) => {
            e.stopPropagation();
            onDelta("toughness", 1);
          }}
          type="button"
        >
          +
        </button>
      </div>
    )}

    <div
      className={cn(
        statGridClassName,
        "rounded-lg border border-zinc-700 bg-zinc-950/90 px-[var(--pt-value-px)] py-[var(--pt-value-py)] shadow-xl",
      )}
      data-card-preview-pt-values
    >
      <span
        data-card-preview-stat-value
        className={getStatClassName(displayPower, comparisonPower)}
      >
        {displayPower}
      </span>

      <span className="text-zinc-600 font-bold text-lg">/</span>

      <span
        data-card-preview-stat-value
        className={getStatClassName(displayToughness, comparisonToughness)}
      >
        {displayToughness}
      </span>
    </div>

    {canEdit && (
      <div className={statGridClassName} data-card-preview-pt-decrements>
        <button
          className={statButtonClassName}
          aria-label="Decrease power"
          onClick={(e) => {
            e.stopPropagation();
            onDelta("power", -1);
          }}
          type="button"
        >
          -
        </button>
        <span aria-hidden="true" />
        <button
          className={statButtonClassName}
          aria-label="Decrease toughness"
          onClick={(e) => {
            e.stopPropagation();
            onDelta("toughness", -1);
          }}
          type="button"
        >
          -
        </button>
      </div>
    )}
  </div>
);
