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
import { canManageFaceDownExileReveal } from "@/lib/reveal";

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
  turnExiledCardFaceUp?: (cardId: CardId) => void,
): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (currentZone.type === ZONE.LIBRARY) {
    if (setCardReveal && actorId === card.ownerId) {
      items.push(buildRevealMenu({ card, players, actorId, setCardReveal }));
    }

  }

  if (
    currentZone.type === ZONE.EXILE &&
    card.faceDown &&
    viewerRole !== "spectator"
  ) {
    if (
      setCardReveal &&
      canManageFaceDownExileReveal({
        card,
        zone: currentZone,
        viewerId: actorId,
        viewerRole,
      })
    ) {
      items.push(
        buildRevealMenu({
          card,
          players,
          actorId,
          setCardReveal,
          audienceMode: "allPlayers",
        }),
      );
    }
    if (currentZone.ownerId === actorId && turnExiledCardFaceUp) {
      items.push({
        type: "action",
        label: "Turn face up",
        onSelect: () => turnExiledCardFaceUp(card.id),
      });
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
