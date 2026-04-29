export type ParsedDecklistCardLine = {
  quantity: number;
  name: string;
  set: string;
  collectorNumber: string;
  hasQuantityToken: boolean;
  quantityToken?: string;
  rest: string;
};

const DETAILED_PATTERN =
  /^(\d+x?)\s+(.+?)\s+\(([a-zA-Z0-9]{3,})\)\s+(\S+).*$/;
const SIMPLE_PATTERN = /^(\d+x?)\s+(.+)$/;

const parseQuantityToken = (token: string) => {
  const parsed = Number.parseInt(token.replace("x", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseDecklistCardLine = (
  trimmedLine: string
): ParsedDecklistCardLine | null => {
  if (!trimmedLine) return null;

  const simpleMatch = trimmedLine.match(SIMPLE_PATTERN);
  if (simpleMatch) {
    const quantityToken = simpleMatch[1];
    const rest = simpleMatch[2];
    const detailedMatch = trimmedLine.match(DETAILED_PATTERN);

    return {
      quantity: parseQuantityToken(quantityToken),
      name: (detailedMatch ? detailedMatch[2] : rest).trim(),
      set: detailedMatch?.[3]?.toLowerCase() ?? "",
      collectorNumber: detailedMatch?.[4] ?? "",
      hasQuantityToken: true,
      quantityToken,
      rest,
    };
  }

  return {
    quantity: 1,
    name: trimmedLine,
    set: "",
    collectorNumber: "",
    hasQuantityToken: false,
    rest: trimmedLine,
  };
};
