import "mana-font/css/mana.css";

import { cn } from "@/lib/utils";
import { normalizeColorIdentity, type ManaColor } from "@/data/curatedDecks";

const MANA_LABELS: Record<ManaColor, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
};

const manaClassName = (color: ManaColor) => `ms-${color.toLowerCase()}`;

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

export type ManaSymbolsProps = {
  colors: readonly ManaColor[];
  className?: string;
  symbolClassName?: string;
};

export const ManaSymbols = ({ colors, className, symbolClassName }: ManaSymbolsProps) => {
  const normalized = normalizeColorIdentity(colors);
  const label = normalized.map((color) => MANA_LABELS[color]).join(", ");

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={label ? `${label} mana` : "no color identity"}
    >
      {normalized.map((color) => (
        <i
          key={color}
          aria-hidden="true"
          className={joinClassNames(
            "ms",
            "ms-cost",
            "text-[0.95em]",
            "shadow-sm",
            manaClassName(color),
            symbolClassName
          )}
        />
      ))}
    </span>
  );
};
