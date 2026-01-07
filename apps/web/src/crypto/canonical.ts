import canonicalize from "canonicalize";

import { utf8ToBytes } from "./bytes";

const stripUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const next = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i += 1) {
      if (!(i in value)) {
        throw new Error("Sparse arrays are not supported in canonicalization");
      }
      const cleaned = stripUndefined(value[i]);
      if (cleaned === undefined) {
        throw new Error(
          "Undefined values are not allowed in arrays for canonicalization",
        );
      }
      next[i] = cleaned;
    }
    return next;
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const cleaned = stripUndefined(entry);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    }
    return next;
  }

  if (value === undefined) return undefined;
  return value;
};

export const canonicalizeJson = (value: unknown): string => {
  const cleaned = stripUndefined(value);
  const result = canonicalize(cleaned);
  if (typeof result !== "string") {
    throw new Error("Failed to canonicalize JSON payload");
  }
  return result;
};

export const canonicalizeJsonBytes = (value: unknown): Uint8Array => {
  return utf8ToBytes(canonicalizeJson(value));
};
