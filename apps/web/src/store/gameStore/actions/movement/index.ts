import type { GameState } from "@/types";

import type { Deps, GetState, SetState } from "./types";
import { createMoveCard } from "./moveCard";
import { createMoveCardToBottom } from "./moveCardToBottom";
import { createMoveCards } from "./moveCards";

export const createMovementActions = (
  set: SetState,
  get: GetState,
  deps: Deps
): Pick<GameState, "moveCard" | "moveCards" | "moveCardToBottom"> => ({
  moveCard: createMoveCard(set, get, deps),
  moveCards: createMoveCards(set, get, deps),
  moveCardToBottom: createMoveCardToBottom(set, get, deps),
});
