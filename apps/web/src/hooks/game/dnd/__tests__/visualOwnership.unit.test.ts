import { describe, expect, it } from "vitest";

import {
  filterPendingDropVisualClaims,
  shouldRetainPendingDropVisualClaim,
  type PendingDropVisualClaim,
} from "@/lib/dndVisualOwnership";

describe("drop visual ownership", () => {
  it("retains claims while their source zone still renders the card", () => {
    const claims: PendingDropVisualClaim[] = [
      {
        cardId: "c1",
        sourceZoneId: "p1-battlefield",
        targetZoneId: "p1-hand",
      },
      {
        cardId: "c2",
        sourceZoneId: "p1-hand",
        targetZoneId: "p1-battlefield",
      },
    ];

    const retained = filterPendingDropVisualClaims(
      claims,
      (claim) => claim.cardId === "c1"
    );

    expect(retained).toEqual([claims[0]]);
  });

  it("retains a claim until the target zone has rendered the card", () => {
    expect(
      shouldRetainPendingDropVisualClaim({
        sourceRendered: false,
        targetRendered: false,
        frameCount: 4,
        minFrames: 4,
      })
    ).toBe(true);
    expect(
      shouldRetainPendingDropVisualClaim({
        sourceRendered: false,
        targetRendered: true,
        frameCount: 0,
        minFrames: 4,
      })
    ).toBe(true);
    expect(
      shouldRetainPendingDropVisualClaim({
        sourceRendered: false,
        targetRendered: true,
        frameCount: 4,
        minFrames: 4,
      })
    ).toBe(false);
  });
});
