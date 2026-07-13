import "mana-font/css/mana.css";

import { cn } from "@/lib/utils";

const SYMBOL_PATTERN = /\{([^}]+)\}/g;

const toManaClass = (symbol: string) => {
  const normalized = symbol.trim().toLowerCase().replaceAll("/", "");
  if (normalized === "½") return "1-2";
  return normalized.replaceAll("∞", "infinity");
};

export type ManaCostProps = {
  manaCost?: string;
  className?: string;
  symbolClassName?: string;
};

export const ManaCost = ({ manaCost, className, symbolClassName }: ManaCostProps) => {
  if (!manaCost?.trim()) {
    return (
      <span className={cn("text-zinc-600", className)} aria-label="No mana cost">
        —
      </span>
    );
  }

  const parts = manaCost.split(/\s*(\/\/)\s*/);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap", className)}
      role="img"
      aria-label={`Mana cost ${manaCost}`}
      title={manaCost}
    >
      {parts.map((part, partIndex) => {
        if (part === "//") {
          return (
            <span key={`separator-${partIndex}`} aria-hidden="true" className="mx-1 text-zinc-600">
              /
            </span>
          );
        }

        const symbols = [...part.matchAll(SYMBOL_PATTERN)];
        if (!symbols.length) {
          return (
            <span key={`literal-${partIndex}`} aria-hidden="true" className="text-xs text-zinc-400">
              {part}
            </span>
          );
        }

        return symbols.map((match, symbolIndex) => (
          <i
            key={`${partIndex}-${symbolIndex}-${match[1]}`}
            aria-hidden="true"
            className={cn(
              "ms ms-cost text-[0.95em] shadow-sm",
              `ms-${toManaClass(match[1])}`,
              symbolClassName
            )}
          />
        ));
      })}
    </span>
  );
};
