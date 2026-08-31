import { describe, expect, it } from "vitest";

import { hasSameMembers, placeCardId, placeCardIdFromTop } from "../lists";

describe("server list helpers", () => {
  it("should treat arrays with the same members as equal regardless of order", () => {
    expect(hasSameMembers(["a", "b", "c"], ["c", "a", "b"]))
      .toBe(true);
  });

  it("should reject arrays with duplicates or mismatched sizes", () => {
    expect(hasSameMembers(["a", "a"], ["a"]))
      .toBe(false);
    expect(hasSameMembers(["a", "b"], ["a", "b", "c"]))
      .toBe(false);
  });

  it("should place cards on top by default and remove prior entries", () => {
    expect(placeCardId(["a", "b", "c"], "b", "top"))
      .toEqual(["a", "c", "b"]);
  });

  it("should place cards on the bottom when requested", () => {
    expect(placeCardId(["a", "b", "c"], "b", "bottom"))
      .toEqual(["b", "a", "c"]);
  });

  it("should place cards at an exact position counted from the top", () => {
    expect(placeCardIdFromTop(["a", "b", "c", "d"], "x", 3)).toEqual([
      "a",
      "b",
      "x",
      "c",
      "d",
    ]);
    expect(placeCardIdFromTop(["a", "b", "c", "d"], "b", 2)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });
});
