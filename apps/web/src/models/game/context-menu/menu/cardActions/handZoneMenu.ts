import type { Card, PlayerId, ViewerRole, Zone, ZoneId } from "@/types";

import { getPlayerZones } from "@/lib/gameSelectors";
import { ZONE } from "@/constants/zones";
import { canMoveCard } from "@/rules/permissions";

import type { ContextMenuItem } from "../types";

type BuildHandZoneMenuItemsParams = {
  card: Card;
  currentZone: Zone | undefined;
  zones: Record<ZoneId, Zone>;
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  openRandomDiscardPrompt?: (handCount: number) => void;
};

export const buildHandZoneMenuItems = ({
  card,
  currentZone,
  zones,
  myPlayerId,
  viewerRole,
  openRandomDiscardPrompt,
}: BuildHandZoneMenuItemsParams): ContextMenuItem[] => {
  if (currentZone?.type !== ZONE.HAND) return [];

  const items: ContextMenuItem[] = [];
  const playerZones = getPlayerZones(zones, myPlayerId);

  if (playerZones.graveyard) {
    const permission = canMoveCard({
      actorId: myPlayerId,
      role: viewerRole,
      card,
      fromZone: currentZone,
      toZone: playerZones.graveyard,
    });
    if (
      permission.allowed &&
      openRandomDiscardPrompt &&
      currentZone.cardIds.length > 0
    ) {
      items.push({
        type: "action",
        label: "Discard random card",
        onSelect: () => openRandomDiscardPrompt(currentZone.cardIds.length),
        danger: true,
      });
    }
  }

  return items;
};
