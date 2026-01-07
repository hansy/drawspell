import type { Card, LibraryTopRevealMode, Player, PlayerId, ViewerRole, Zone } from "@/types";

import { ZONE } from "@/constants/zones";
import { canViewerSeeLibraryCardByReveal } from "@/lib/reveal";

export const resolveZoneOwnerName = (params: {
  zone: Pick<Zone, "ownerId"> | null;
  players: Record<PlayerId, Pick<Player, "name">>;
}): string => {
  if (!params.zone) return "";
  return params.players[params.zone.ownerId]?.name ?? params.zone.ownerId;
};

export const computeRevealedOpponentLibraryCardIds = (params: {
  zone: Zone | null;
  cardsById: Record<string, Card>;
  viewerId: PlayerId;
  viewerRole?: ViewerRole;
  libraryTopReveal?: LibraryTopRevealMode;
}): string[] => {
  if (!params.zone || params.zone.type !== ZONE.LIBRARY) return [];
  if (params.zone.ownerId === params.viewerId) return [];

  // zone.cardIds is [bottom..top]; show top-first, preserving relative order.
  const topCardId = getLibraryTopCardId(params.zone);
  const revealTopToAll = params.libraryTopReveal === "all" && Boolean(topCardId);
  const visible = params.zone.cardIds.filter((id) => {
    const card = params.cardsById[id];
    if (!card) return false;
    if (revealTopToAll && id === topCardId) return true;
    return canViewerSeeLibraryCardByReveal(card, params.viewerId, params.viewerRole);
  });
  return visible.reverse();
};

export const getLibraryTopCardId = (zone: Zone | null): string | null => {
  if (!zone || zone.type !== ZONE.LIBRARY) return null;
  return zone.cardIds.length ? zone.cardIds[zone.cardIds.length - 1] : null;
};
