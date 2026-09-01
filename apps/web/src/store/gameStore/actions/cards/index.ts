import type { GameState } from "@/types";

import type { Deps, GetState, SetState } from "./types";

import { createAddCard } from "./addCard";
import { createAddCards } from "./addCards";
import { createDuplicateCard } from "./duplicateCard";
import { createRemoveCard } from "./removeCard";
import { createSetCardReveal } from "./setCardReveal";
import { createSetCardsReveal } from "./setCardsReveal";
import { createTapCard } from "./tapCard";
import { createTransformCard } from "./transformCard";
import { createTurnExiledCardFaceUp } from "./turnExiledCardFaceUp";
import { createUntapAll } from "./untapAll";
import { createUpdateCard } from "./updateCard";

export const createCardActions = (
  set: SetState,
  get: GetState,
  deps: Deps
): Pick<
  GameState,
  | "addCard"
  | "addCards"
  | "duplicateCard"
  | "updateCard"
  | "transformCard"
  | "turnExiledCardFaceUp"
  | "removeCard"
  | "tapCard"
  | "untapAll"
  | "setCardReveal"
  | "setCardsReveal"
> => ({
  addCard: createAddCard(set, get, deps),
  addCards: createAddCards(set, get, deps),
  duplicateCard: createDuplicateCard(set, get, deps),
  updateCard: createUpdateCard(set, get, deps),
  transformCard: createTransformCard(set, get, deps),
  turnExiledCardFaceUp: createTurnExiledCardFaceUp(set, get, deps),
  removeCard: createRemoveCard(set, get, deps),
  tapCard: createTapCard(set, get, deps),
  untapAll: createUntapAll(set, get, deps),
  setCardReveal: createSetCardReveal(set, get, deps),
  setCardsReveal: createSetCardsReveal(set, get, deps),
});
