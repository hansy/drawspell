import type { Card, CardId, PlayerId, ViewerRole, Zone, ZoneId } from "@/types";

import { ZONE, ZONE_LABEL } from "@/constants/zones";
import { getPlayerZones } from "@/lib/gameSelectors";
import { canMoveCard } from "@/rules/permissions";

import type { ContextMenuMoveCardFn } from "../actionTypes";
import type { ContextMenuItem, OpenCountPrompt } from "../types";

type BuildMoveToMenuParams = {
  card: Card;
  currentZone: Zone | undefined;
  zones: Record<ZoneId, Zone>;
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  moveCard: ContextMenuMoveCardFn;
  moveCardToBottom?: (cardId: CardId, toZoneId: ZoneId) => void;
  libraryCardCount?: number;
  openCountPrompt?: OpenCountPrompt;
};

export const buildMoveToMenuItem = ({
  card,
  currentZone,
  zones,
  myPlayerId,
  viewerRole,
  moveCard,
  moveCardToBottom,
  libraryCardCount,
  openCountPrompt,
}: BuildMoveToMenuParams): ContextMenuItem | null => {
  if (!currentZone) return null;

  const playerZones = getPlayerZones(zones, card.ownerId);
  const submenu: ContextMenuItem[] = [];

  const canMoveTo = (targetZone: Zone | undefined) => {
    if (!targetZone) return false;
    if (targetZone.id === currentZone.id && targetZone.type !== ZONE.LIBRARY) {
      return false;
    }
    const permission = canMoveCard({
      actorId: myPlayerId,
      role: viewerRole,
      card,
      fromZone: currentZone,
      toZone: targetZone,
    });
    return permission.allowed;
  };

  const addIfAllowed = (targetZone: Zone | undefined, label: string, mover: () => void) => {
    if (canMoveTo(targetZone)) {
      submenu.push({ type: "action", label, onSelect: mover });
    }
  };

  if (canMoveTo(playerZones.battlefield)) {
    submenu.push({
      type: "action",
      label: `${ZONE_LABEL.battlefield} ...`,
      onSelect: () => {},
      submenu: [
        {
          type: "action",
          label: "Face up",
          onSelect: () => moveCard(card.id, playerZones.battlefield!.id),
        },
        {
          type: "action",
          label: "Face down ...",
          onSelect: () => {},
          submenu: [
            {
              type: "action",
              label: "with morph (2/2)",
              onSelect: () =>
                moveCard(
                  card.id,
                  playerZones.battlefield!.id,
                  undefined,
                  undefined,
                  undefined,
                  { faceDown: true, faceDownMode: "morph" }
                ),
            },
            {
              type: "action",
              label: "without morph",
              onSelect: () =>
                moveCard(
                  card.id,
                  playerZones.battlefield!.id,
                  undefined,
                  undefined,
                  undefined,
                  { faceDown: true }
                ),
            },
          ],
        },
      ],
    });
  }

  addIfAllowed(playerZones.hand, ZONE_LABEL.hand, () =>
    moveCard(card.id, playerZones.hand!.id)
  );
  addIfAllowed(playerZones.graveyard, ZONE_LABEL.graveyard, () =>
    moveCard(card.id, playerZones.graveyard!.id)
  );
  addIfAllowed(playerZones.exile, ZONE_LABEL.exile, () =>
    moveCard(card.id, playerZones.exile!.id)
  );

  if (canMoveTo(playerZones.library)) {
    const currentLibraryCount =
      typeof libraryCardCount === "number" && Number.isFinite(libraryCardCount)
        ? Math.max(0, Math.floor(libraryCardCount))
        : playerZones.library!.cardIds.length;
    const finalLibraryCount =
      currentZone.id === playerZones.library!.id
        ? currentLibraryCount
        : currentLibraryCount + 1;
    const libraryItems: ContextMenuItem[] = [
      {
        type: "action",
        label: "Top",
        onSelect: () => moveCard(card.id, playerZones.library!.id),
      },
    ];
    if (openCountPrompt && finalLibraryCount > 1) {
      libraryItems.push({
        type: "action",
        label: "Nth from Top...",
        onSelect: () =>
          openCountPrompt({
            title: "Move to Nth from Top",
            message: "Choose the card's final position, counting from the top of the library.",
            inputLabel: "Position from top",
            initialValue: Math.min(2, finalLibraryCount),
            minValue: 1,
            maxValue: finalLibraryCount,
            confirmLabel: "Move card",
            onSubmit: (positionFromTop) =>
              moveCard(
                card.id,
                playerZones.library!.id,
                undefined,
                undefined,
                undefined,
                { libraryPositionFromTop: positionFromTop }
              ),
          }),
      });
    }
    if (moveCardToBottom) {
      libraryItems.push({
        type: "action",
        label: "Bottom",
        onSelect: () => moveCardToBottom(card.id, playerZones.library!.id),
      });
    }
    submenu.push({
      type: "action",
      label: `${ZONE_LABEL.library} ...`,
      onSelect: () => {},
      submenu: libraryItems,
    });
  }

  if (submenu.length === 0) return null;

  return {
    type: "action",
    label: "Move to...",
    onSelect: () => {},
    submenu,
  };
};
