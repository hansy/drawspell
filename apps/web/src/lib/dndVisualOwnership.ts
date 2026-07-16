import type { CardId, ZoneId } from "@/types";

export type PendingDropVisualClaim = {
  cardId: CardId;
  sourceZoneId: ZoneId;
  targetZoneId: ZoneId;
};

type PendingDropVisualClaimIndex = ReadonlyMap<ZoneId, ReadonlySet<CardId>>;

const pendingDropVisualClaimIndexes = new WeakMap<
  readonly PendingDropVisualClaim[],
  PendingDropVisualClaimIndex
>();

export const getPendingDropVisualClaimIndex = (
  claims: readonly PendingDropVisualClaim[]
): PendingDropVisualClaimIndex => {
  const cached = pendingDropVisualClaimIndexes.get(claims);
  if (cached) return cached;

  const mutableIndex = new Map<ZoneId, Set<CardId>>();
  claims.forEach((claim) => {
    const sourceCardIds = mutableIndex.get(claim.sourceZoneId) ?? new Set<CardId>();
    sourceCardIds.add(claim.cardId);
    mutableIndex.set(claim.sourceZoneId, sourceCardIds);
  });
  pendingDropVisualClaimIndexes.set(claims, mutableIndex);
  return mutableIndex;
};

export const hasPendingDropVisualClaim = (
  claims: readonly PendingDropVisualClaim[],
  cardId: CardId,
  sourceZoneId: ZoneId
) => getPendingDropVisualClaimIndex(claims).get(sourceZoneId)?.has(cardId) ?? false;

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
