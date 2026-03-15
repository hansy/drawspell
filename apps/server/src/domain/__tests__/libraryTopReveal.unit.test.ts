import { describe, expect, it } from "vitest";

import {
  libraryTopRevealIncludesPlayer,
  libraryTopRevealIsSelfOnly,
  libraryTopRevealSelectedIds,
} from "@mtg/shared/types/players";

describe("library top reveal helpers", () => {
  it("treats malformed recipient lists as invalid instead of throwing", () => {
    const malformedReveal = { to: 123 } as any;

    expect(
      libraryTopRevealIncludesPlayer(malformedReveal, "p2", "p1"),
    ).toBe(false);
    expect(
      libraryTopRevealSelectedIds(malformedReveal, "p1", ["p1", "p2"]),
    ).toEqual([]);
    expect(libraryTopRevealIsSelfOnly(malformedReveal, "p1")).toBe(false);
  });
});
