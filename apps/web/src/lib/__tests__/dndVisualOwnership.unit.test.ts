import { describe, expect, it } from "vitest";

import {
  getPendingDropVisualClaimIndex,
  hasPendingDropVisualClaim,
  type PendingDropVisualClaim,
} from "../dndVisualOwnership";

describe("pending drop visual ownership", () => {
  it("reuses an indexed lookup for an immutable claim snapshot", () => {
    const claims: PendingDropVisualClaim[] = [
      { cardId: "c1", sourceZoneId: "hand", targetZoneId: "battlefield" },
      { cardId: "c2", sourceZoneId: "hand", targetZoneId: "battlefield" },
      { cardId: "c3", sourceZoneId: "graveyard", targetZoneId: "hand" },
    ];

    expect(getPendingDropVisualClaimIndex(claims)).toBe(
      getPendingDropVisualClaimIndex(claims)
    );
    expect(hasPendingDropVisualClaim(claims, "c2", "hand")).toBe(true);
    expect(hasPendingDropVisualClaim(claims, "c2", "graveyard")).toBe(false);
    expect(hasPendingDropVisualClaim(claims, "missing", "hand")).toBe(false);
  });
});
