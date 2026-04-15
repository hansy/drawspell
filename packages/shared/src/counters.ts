export type ParsedCounterType =
  | {
      kind: "pt";
      canonicalType: string;
      powerDelta: number;
      toughnessDelta: number;
    }
  | {
      kind: "text";
      canonicalType: string;
    };

const PT_COUNTER_PATTERN = /^([+-]\d+)\/([+-]\d+)$/;

const clampTypeLength = (value: string, maxLen: number) => value.slice(0, maxLen);

const canonicalizeSignedNumber = (raw: string) => {
  const parsed = Number.parseInt(raw, 10);
  const sign = parsed >= 0 ? "+" : "-";
  return `${sign}${Math.abs(parsed)}`;
};

export const parseCounterType = (
  raw: string,
  maxLen = 64
): ParsedCounterType => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "text", canonicalType: "" };
  }

  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length <= maxLen) {
    const match = compact.match(PT_COUNTER_PATTERN);
    if (match) {
      const powerDelta = Number.parseInt(match[1] ?? "0", 10);
      const toughnessDelta = Number.parseInt(match[2] ?? "0", 10);
      return {
        kind: "pt",
        canonicalType: `${canonicalizeSignedNumber(match[1] ?? "+0")}/${canonicalizeSignedNumber(
          match[2] ?? "+0"
        )}`,
        powerDelta,
        toughnessDelta,
      };
    }
  }

  return {
    kind: "text",
    canonicalType: clampTypeLength(trimmed.toLowerCase(), maxLen),
  };
};

export const normalizeCounterType = (raw: string, maxLen = 64): string =>
  parseCounterType(raw, maxLen).canonicalType;

export const parsePTCounterType = (
  raw: string,
  maxLen = 64
): Extract<ParsedCounterType, { kind: "pt" }> | null => {
  const parsed = parseCounterType(raw, maxLen);
  return parsed.kind === "pt" ? parsed : null;
};
