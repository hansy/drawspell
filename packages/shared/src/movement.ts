import {
  isCommanderZoneType,
  isHiddenZoneType,
  isPublicZoneType,
  ZONE,
} from "./constants/zones";
import type { Card, FaceDownMode } from "./types/cards";
import type { Zone } from "./types/zones";
import {
  getCanonicalBattlefieldPlacementGridSteps,
  normalizeMovePosition,
  resolveBattlefieldCollisionPosition,
  resolveBattlefieldGroupCollisionPositions,
  type Position,
} from "./positions";
import { resetCardToFrontFace } from "./cards";

export { normalizeMovePosition } from "./positions";

export type CardMovementPlacement = "top" | "bottom";

export type CardMovementOptions = {
  faceDown?: boolean;
  faceDownMode?: FaceDownMode;
  random?: boolean;
  suppressLog?: boolean;
  skipCollision?: boolean;
  groupCollision?: {
    movingCardIds: string[];
    targetPositions: Record<string, Position | undefined>;
  };
};

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

export type CardMovementVisibility = {
  fromHidden: boolean;
  toHidden: boolean;
  fromPublic: boolean;
  toPublic: boolean;
};

export type CardMovementLogFacts =
  | { event: "none" }
  | {
      event: "draw" | "discard";
      playerId: string;
      count: 1;
    }
  | {
      event: "move";
      fromZoneType: Zone["type"];
      toZoneType: Zone["type"];
      placement: CardMovementPlacement;
      random: boolean;
      faceDown: boolean;
      forceHidden: boolean;
      cardName: string;
      gainsControlBy?: string;
    };

export type CardMovementPlan = {
  cardId: Card["id"];
  fromZoneId: Zone["id"];
  toZoneId: Zone["id"];
  placement: CardMovementPlacement;
  visibility: CardMovementVisibility;
  tokenLeavesBattlefield: boolean;
  resetToFrontFace: boolean;
  enteringFaceDownBattlefield: boolean;
  leavingFaceDownBattlefield: boolean;
  shouldMarkCommander: boolean;
  nextControllerId: string;
  controlWillChange: boolean;
  faceDown: FaceDownMoveResolution;
  revealPatch: RevealPatch;
  cardPatch: Partial<
    Pick<
      Card,
      | "zoneId"
      | "position"
      | "tapped"
      | "counters"
      | "faceDown"
      | "faceDownMode"
      | "controllerId"
      | "isCommander"
      | "knownToAll"
      | "revealedToAll"
      | "revealedTo"
    >
  >;
  logFacts: CardMovementLogFacts;
};

const resolveBattlefieldEntryFallbackPosition = (
  position: Position | undefined,
  fromZone: Pick<Zone, "type">,
  toZone: Pick<Zone, "type">
): Position | undefined =>
  !position && toZone.type === ZONE.BATTLEFIELD && fromZone.type !== ZONE.BATTLEFIELD
    ? { x: 0.5, y: 0.5 }
    : position;

const resolveBattlefieldPlacementStepY = (
  getStepY: ((id: string) => number | undefined) | undefined,
  id: string
) =>
  getStepY?.(id) ??
  getCanonicalBattlefieldPlacementGridSteps().stepY;

const resolveGroupCollisionOptions = (
  groupCollision: NonNullable<CardMovementOptions["groupCollision"]>
) => {
  const targetPositions = groupCollision.targetPositions;

  return {
    movingCardIds: Array.isArray(groupCollision.movingCardIds)
      ? groupCollision.movingCardIds
      : [],
    targetPositions:
      targetPositions && typeof targetPositions === "object"
        ? targetPositions
        : {},
  };
};

export const resolveCardMovementPosition = ({
  card,
  cardId = card.id,
  fromZone,
  toZone,
  orderedCardIds,
  position,
  opts,
  getPosition,
  getStepY,
}: {
  card: Pick<Card, "id" | "position" | "tapped">;
  cardId?: Card["id"];
  fromZone: Pick<Zone, "type">;
  toZone: Pick<Zone, "type">;
  orderedCardIds: string[];
  position?: Position;
  opts?: CardMovementOptions;
  getPosition: (id: string) => Position | undefined;
  getStepY?: (id: string) => number | undefined;
}): Position => {
  const fallbackPosition = resolveBattlefieldEntryFallbackPosition(
    position,
    fromZone,
    toZone
  );
  const resolvedPosition = normalizeMovePosition(fallbackPosition, card.position);

  if (
    toZone.type !== ZONE.BATTLEFIELD ||
    !fallbackPosition ||
    (opts?.skipCollision && !opts?.groupCollision)
  ) {
    return resolvedPosition;
  }

  if (opts?.groupCollision) {
    const groupCollision = resolveGroupCollisionOptions(opts.groupCollision);
    const resolved = resolveBattlefieldGroupCollisionPositions({
      movingCardIds: groupCollision.movingCardIds,
      targetPositions: groupCollision.targetPositions,
      orderedCardIds,
      getPosition,
      getStepY: (id) => resolveBattlefieldPlacementStepY(getStepY, id),
    });
    return resolved[cardId] ?? resolvedPosition;
  }

  const stepY = resolveBattlefieldPlacementStepY(getStepY, cardId);
  return resolveBattlefieldCollisionPosition({
    movingCardId: cardId,
    targetPosition: resolvedPosition,
    orderedCardIds,
    getPosition,
    stepY,
  });
};

export const buildMovedCard = (
  card: Card,
  plan: CardMovementPlan,
  options?: { resetCardToFrontFace?: (card: Card) => Card }
): Card => ({
  ...(plan.resetToFrontFace
    ? (options?.resetCardToFrontFace ?? resetCardToFrontFace)(card)
    : card),
  ...plan.cardPatch,
});

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
  const toHidden = isHiddenZoneType(toZoneType);
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

const enforceZoneCounterRulesForMove = (
  counters: Card["counters"],
  zone: Pick<Zone, "type">
): Card["counters"] => (zone.type === ZONE.BATTLEFIELD ? counters : []);

const resolveMoveLogFacts = (params: {
  card: Pick<Card, "id" | "name" | "faceDown">;
  fromZone: Zone;
  toZone: Zone;
  placement: CardMovementPlacement;
  opts?: CardMovementOptions;
  faceDown: FaceDownMoveResolution;
  controlWillChange: boolean;
  nextControllerId: string;
  cardNameForLog?: string;
}): CardMovementLogFacts => {
  if (params.opts?.suppressLog) {
    if (params.fromZone.type === ZONE.LIBRARY && params.toZone.type === ZONE.HAND) {
      return { event: "draw", playerId: params.fromZone.ownerId, count: 1 };
    }
    if (params.fromZone.type === ZONE.LIBRARY && params.toZone.type === ZONE.GRAVEYARD) {
      return { event: "discard", playerId: params.fromZone.ownerId, count: 1 };
    }
    return { event: "none" };
  }

  const sameBattlefield =
    params.fromZone.type === ZONE.BATTLEFIELD &&
    params.toZone.type === ZONE.BATTLEFIELD &&
    params.fromZone.id === params.toZone.id;
  if (sameBattlefield) return { event: "none" };

  const leavingFaceDownBattlefield =
    params.fromZone.type === ZONE.BATTLEFIELD &&
    params.toZone.type !== ZONE.BATTLEFIELD &&
    params.card.faceDown;
  const enteringFaceDownBattlefield =
    params.toZone.type === ZONE.BATTLEFIELD &&
    params.faceDown.effectiveFaceDown;
  const shouldHideMoveName =
    !isPublicZoneType(params.toZone.type) ||
    enteringFaceDownBattlefield ||
    (leavingFaceDownBattlefield && !isPublicZoneType(params.toZone.type));
  const cardName = shouldHideMoveName
    ? "a card"
    : params.cardNameForLog ?? params.card.name;

  return {
    event: "move",
    fromZoneType: params.fromZone.type,
    toZoneType: params.toZone.type,
    placement: params.placement,
    random: params.opts?.random === true,
    faceDown: params.faceDown.effectiveFaceDown,
    forceHidden: shouldHideMoveName,
    cardName,
    ...(params.controlWillChange && params.toZone.type === ZONE.BATTLEFIELD
      ? { gainsControlBy: params.nextControllerId }
      : null),
  };
};

export const planCardMovement = ({
  card,
  fromZone,
  toZone,
  placement,
  position,
  opts,
  cardNameForLog,
}: {
  card: Card;
  fromZone: Zone;
  toZone: Zone;
  placement: CardMovementPlacement;
  position?: Position;
  opts?: CardMovementOptions;
  cardNameForLog?: string;
}): CardMovementPlan => {
  const visibility = {
    fromHidden: isHiddenZoneType(fromZone.type),
    toHidden: isHiddenZoneType(toZone.type),
    fromPublic: isPublicZoneType(fromZone.type),
    toPublic: isPublicZoneType(toZone.type),
  };
  const shouldMarkCommander =
    isCommanderZoneType(toZone.type) &&
    card.ownerId === toZone.ownerId &&
    !card.isCommander &&
    !card.isToken;
  const fallbackPosition = resolveBattlefieldEntryFallbackPosition(
    position,
    fromZone,
    toZone
  );
  const facts = resolveCardMovementFacts({
    card,
    fromZone,
    toZone,
    position: fallbackPosition,
    fallbackPosition: card.position,
    requestedFaceDown: opts?.faceDown,
    requestedFaceDownMode: opts?.faceDownMode,
  });
  const tokenLeavesBattlefield =
    card.isToken === true &&
    fromZone.type === ZONE.BATTLEFIELD &&
    toZone.type !== ZONE.BATTLEFIELD;
  const resetToFrontFace =
    fromZone.type === ZONE.BATTLEFIELD && toZone.type !== ZONE.BATTLEFIELD;
  const enteringFaceDownBattlefield =
    toZone.type === ZONE.BATTLEFIELD && facts.faceDown.effectiveFaceDown;
  const leavingFaceDownBattlefield =
    fromZone.type === ZONE.BATTLEFIELD && toZone.type !== ZONE.BATTLEFIELD && card.faceDown;
  const nextTapped = toZone.type === ZONE.BATTLEFIELD ? card.tapped : false;
  const cardPatch: CardMovementPlan["cardPatch"] = {
    zoneId: toZone.id,
    position: facts.position,
    tapped: nextTapped,
    counters: enforceZoneCounterRulesForMove(card.counters, toZone),
    faceDown: toZone.type === ZONE.BATTLEFIELD ? facts.faceDown.effectiveFaceDown : false,
    faceDownMode:
      toZone.type === ZONE.BATTLEFIELD ? facts.faceDown.effectiveFaceDownMode : undefined,
    controllerId: facts.controlWillChange ? facts.nextControllerId : card.controllerId,
    isCommander: shouldMarkCommander ? true : card.isCommander,
    ...(facts.revealPatch ?? {}),
  };

  return {
    cardId: card.id,
    fromZoneId: fromZone.id,
    toZoneId: toZone.id,
    placement,
    visibility,
    tokenLeavesBattlefield,
    resetToFrontFace,
    enteringFaceDownBattlefield,
    leavingFaceDownBattlefield,
    shouldMarkCommander,
    nextControllerId: facts.nextControllerId,
    controlWillChange: facts.controlWillChange,
    faceDown: facts.faceDown,
    revealPatch: facts.revealPatch,
    cardPatch,
    logFacts: resolveMoveLogFacts({
      card,
      fromZone,
      toZone,
      placement,
      opts,
      faceDown: facts.faceDown,
      controlWillChange: facts.controlWillChange,
      nextControllerId: facts.nextControllerId,
      cardNameForLog,
    }),
  };
};
