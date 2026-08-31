import type {
  Card,
  CardId,
  CardReveal,
  Player,
  PlayerId,
  ViewerRole,
  Zone,
  ZoneId,
} from "@/types";

import { ZONE } from "@/constants/zones";

import type { ContextMenuMoveCardFn } from "./actionTypes";
import type { ContextMenuItem, OpenCountPrompt } from "./types";
import { buildRevealMenu } from "./reveal";
import { buildMoveToMenuItem } from "./cardActions/moveToMenu";

export const buildZoneMoveActions = (
  card: Card,
  currentZone: Zone,
  allZones: Record<ZoneId, Zone>,
  actorId: PlayerId,
  moveCard: ContextMenuMoveCardFn,
  moveCardToBottom?: (cardId: CardId, toZoneId: ZoneId) => void,
  players?: Record<PlayerId, Player>,
  setCardReveal?: (
    cardId: CardId,
    reveal: CardReveal
  ) => void,
  viewerRole?: ViewerRole,
  openCountPrompt?: OpenCountPrompt,
): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (currentZone.type === ZONE.LIBRARY) {
    if (setCardReveal && actorId === card.ownerId) {
      items.push(buildRevealMenu({ card, players, actorId, setCardReveal }));
    }

  }

  const moveToMenu = buildMoveToMenuItem({
    card,
    currentZone,
    zones: allZones,
    myPlayerId: actorId,
    viewerRole,
    moveCard,
    moveCardToBottom,
    libraryCardCount: players?.[card.ownerId]?.libraryCount,
    openCountPrompt,
  });
  if (moveToMenu) items.push(moveToMenu);

  return items;
};
