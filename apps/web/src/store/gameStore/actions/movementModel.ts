import type { Card } from "@/types";
import { resetCardToFrontFace } from "@/lib/cardDisplay";
import {
  buildMovedCard as buildSharedMovedCard,
  type CardMovementPlan,
} from "@mtg/shared/movement";

export type {
  FaceDownMoveResolution,
  RevealPatch,
} from "@mtg/shared/movement";

export const buildMovedCard = (card: Card, plan: CardMovementPlan): Card =>
  buildSharedMovedCard(card, plan, { resetCardToFrontFace });

export {
  computeRevealPatchAfterMove,
  normalizeMovePosition,
  planCardMovement,
  resolveCardMovementFacts,
  resolveCardMovementPosition,
  resolveControllerAfterMove,
  resolveFaceDownAfterMove,
} from "@mtg/shared/movement";
