import { ZONE } from "./constants/zones";
import type { Card, FaceDownMode } from "./types/cards";
import type { Zone } from "./types/zones";
import {
  clampNormalizedPosition,
  migratePositionToNormalized,
  type Position,
} from "./positions";

export type FaceDownMoveResolution = {
  effectiveFaceDown: boolean;
  /**
   * `undefined` means "do not write/patch faceDown" (battlefield-to-battlefield default behavior).
   */
  patchFaceDown?: boolean;
  effectiveFaceDownMode?: FaceDownMode;
  /**
   * `undefined` means "do not write/patch faceDownMode".
   * `null` means "clear faceDownMode".
   */
  patchFaceDownMode?: FaceDownMode | null;
};

export type RevealPatch =
  | Pick<Card, "knownToAll" | "revealedToAll" | "revealedTo">
  | null;

export type CardMovementFacts = {
  nextControllerId: string;
  controlWillChange: boolean;
  faceDown: FaceDownMoveResolution;
  revealPatch: RevealPatch;
  position: Position;
};

export const resolveControllerAfterMove = (
  card: Pick<Card, "ownerId" | "controllerId">,
  fromZone: Pick<Zone, "ownerId" | "type">,
  toZone: Pick<Zone, "ownerId" | "type">,
): string => {
  if (toZone.type === ZONE.BATTLEFIELD) {
    if (toZone.ownerId === card.ownerId) return card.ownerId;
    if (fromZone.ownerId !== toZone.ownerId) return toZone.ownerId;
  } else if (card.controllerId !== card.ownerId) {
    return card.ownerId;
  }
  return card.controllerId;
};

export const normalizeMovePosition = (
  position: Position | undefined,
  fallback: Position,
) => {
  const normalizedInput =
    position && (position.x > 1 || position.y > 1)
      ? migratePositionToNormalized(position)
      : position;
  return clampNormalizedPosition(normalizedInput ?? fallback);
};

const resolveFaceDownModePatch = (
  nextFaceDown: boolean,
  nextFaceDownMode: FaceDownMode | undefined,
  currentFaceDownMode: FaceDownMode | undefined,
): FaceDownMode | null | undefined => {
  if (nextFaceDown) {
    return nextFaceDownMode ?? null;
  }

  return currentFaceDownMode ? null : undefined;
};

export const resolveFaceDownAfterMove = ({
  fromZoneType,
  toZoneType,
  currentFaceDown,
  currentFaceDownMode,
  requestedFaceDown,
  requestedFaceDownMode,
}: {
  fromZoneType: string;
  toZoneType: string;
  currentFaceDown: boolean;
  currentFaceDownMode?: FaceDownMode;
  requestedFaceDown: boolean | undefined;
  requestedFaceDownMode?: FaceDownMode;
}): FaceDownMoveResolution => {
  if (requestedFaceDown !== undefined) {
    const effectiveFaceDownMode = requestedFaceDown
      ? requestedFaceDownMode
      : undefined;
    return {
      effectiveFaceDown: requestedFaceDown,
      patchFaceDown: requestedFaceDown,
      effectiveFaceDownMode,
      patchFaceDownMode: resolveFaceDownModePatch(
        requestedFaceDown,
        requestedFaceDownMode,
        currentFaceDownMode,
      ),
    };
  }

  const battlefieldToBattlefield =
    fromZoneType === ZONE.BATTLEFIELD && toZoneType === ZONE.BATTLEFIELD;
  if (battlefieldToBattlefield) {
    const effectiveFaceDownMode = currentFaceDown
      ? currentFaceDownMode
      : undefined;
    return {
      effectiveFaceDown: currentFaceDown,
      patchFaceDown: undefined,
      effectiveFaceDownMode,
      patchFaceDownMode: currentFaceDown
        ? undefined
        : resolveFaceDownModePatch(false, undefined, currentFaceDownMode),
    };
  }

  return {
    effectiveFaceDown: false,
    patchFaceDown: false,
    effectiveFaceDownMode: undefined,
    patchFaceDownMode: resolveFaceDownModePatch(
      false,
      undefined,
      currentFaceDownMode,
    ),
  };
};

export const computeRevealPatchAfterMove = ({
  fromZoneType,
  toZoneType,
  effectiveFaceDown,
}: {
  fromZoneType: string;
  toZoneType: string;
  effectiveFaceDown: boolean;
}): RevealPatch => {
  const toHidden =
    toZoneType === ZONE.HAND ||
    toZoneType === ZONE.LIBRARY ||
    toZoneType === ZONE.SIDEBOARD;
  const enteringLibrary =
    toZoneType === ZONE.LIBRARY && fromZoneType !== ZONE.LIBRARY;
  const faceDownBattlefield =
    toZoneType === ZONE.BATTLEFIELD && effectiveFaceDown === true;

  if (enteringLibrary || faceDownBattlefield) {
    return { knownToAll: false, revealedToAll: false, revealedTo: [] };
  }

  if (!toHidden && !faceDownBattlefield) {
    return { knownToAll: true, revealedToAll: false, revealedTo: [] };
  }

  return null;
};

export const resolveCardMovementFacts = ({
  card,
  fromZone,
  toZone,
  position,
  fallbackPosition,
  requestedFaceDown,
  requestedFaceDownMode,
}: {
  card: Pick<
    Card,
    "ownerId" | "controllerId" | "faceDown" | "faceDownMode"
  >;
  fromZone: Pick<Zone, "ownerId" | "type">;
  toZone: Pick<Zone, "ownerId" | "type">;
  position?: Position;
  fallbackPosition: Position;
  requestedFaceDown?: boolean;
  requestedFaceDownMode?: FaceDownMode;
}): CardMovementFacts => {
  const nextControllerId = resolveControllerAfterMove(card, fromZone, toZone);
  const faceDown = resolveFaceDownAfterMove({
    fromZoneType: fromZone.type,
    toZoneType: toZone.type,
    currentFaceDown: card.faceDown,
    currentFaceDownMode: card.faceDownMode,
    requestedFaceDown,
    requestedFaceDownMode,
  });

  return {
    nextControllerId,
    controlWillChange: nextControllerId !== card.controllerId,
    faceDown,
    revealPatch: computeRevealPatchAfterMove({
      fromZoneType: fromZone.type,
      toZoneType: toZone.type,
      effectiveFaceDown: faceDown.effectiveFaceDown,
    }),
    position: normalizeMovePosition(position, fallbackPosition),
  };
};
