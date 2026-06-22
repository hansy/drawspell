import type { CardId, ZoneId } from "@/types";

export type PendingDropVisualClaim = {
  cardId: CardId;
  sourceZoneId: ZoneId;
  targetZoneId: ZoneId;
};

export const filterPendingDropVisualClaims = (
  claims: PendingDropVisualClaim[],
  isSourceStillRendered: (claim: PendingDropVisualClaim) => boolean
) => claims.filter((claim) => isSourceStillRendered(claim));

export const shouldRetainPendingDropVisualClaim = (params: {
  sourceRendered: boolean;
  targetRendered: boolean;
  frameCount: number;
  minFrames: number;
}) =>
  params.sourceRendered ||
  !params.targetRendered ||
  params.frameCount < params.minFrames;
