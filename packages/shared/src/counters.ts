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

type ParsedPTCounterType = Extract<ParsedCounterType, { kind: "pt" }>;

const clampTypeLength = (value: string, maxLen: number) => value.slice(0, maxLen);

const parseSignedCounterDelta = (raw: string) => Number.parseInt(raw, 10);

const formatSignedCounterDelta = (delta: number) => {
  const sign = delta >= 0 ? "+" : "-";
  return `${sign}${Math.abs(delta)}`;
};

const canonicalizePTCounterType = (powerDelta: number, toughnessDelta: number) =>
  `${formatSignedCounterDelta(powerDelta)}/${formatSignedCounterDelta(toughnessDelta)}`;

const parsePTCounterMatch = (match: RegExpMatchArray): ParsedPTCounterType => {
  const rawPowerDelta = match[1] ?? "0";
  const rawToughnessDelta = match[2] ?? "0";
  const powerDelta = parseSignedCounterDelta(rawPowerDelta);
  const toughnessDelta = parseSignedCounterDelta(rawToughnessDelta);

  return {
    kind: "pt",
    canonicalType: canonicalizePTCounterType(powerDelta, toughnessDelta),
    powerDelta,
    toughnessDelta,
  };
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
      return parsePTCounterMatch(match);
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
): ParsedPTCounterType | null => {
  const parsed = parseCounterType(raw, maxLen);
  return parsed.kind === "pt" ? parsed : null;
};
