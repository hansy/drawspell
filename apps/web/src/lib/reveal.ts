import type {
  Card,
  LibraryTopRevealMode,
  PlayerId,
  ViewerRole,
  Zone,
  ZoneType,
} from "@/types";
import { ZONE } from "@/constants/zones";
import { isHiddenZoneType } from "@mtg/shared/constants/zones";
import {
  libraryTopRevealIncludesPlayer,
} from "@mtg/shared/types/players";

export const canViewerSeeLibraryCardByReveal = (
  card: Pick<Card, "knownToAll" | "revealedToAll" | "revealedTo">,
  viewerId: PlayerId,
  viewerRole?: ViewerRole
) => {
  if (viewerRole === "spectator") return true;
  if (card.knownToAll) return true;
  if (card.revealedToAll) return true;
  return Boolean(card.revealedTo?.includes(viewerId));
};

export const canViewerSeeLibraryTopCard = (params: {
  viewerId: PlayerId;
  ownerId: PlayerId;
  viewerRole?: ViewerRole;
  mode?: LibraryTopRevealMode | null;
}) => {
  return libraryTopRevealIncludesPlayer(
    params.mode,
    params.viewerId,
    params.ownerId,
    params.viewerRole,
  );
};

export const canViewerPeekBattlefieldFaceDown = (
  card: Pick<Card, "controllerId">,
  viewerId: PlayerId,
  viewerRole?: ViewerRole
) => {
  if (viewerRole === "spectator") return true;
  return card.controllerId === viewerId;
};

export const canViewerSeeCardIdentity = (
  card: Pick<Card, "ownerId" | "controllerId" | "faceDown" | "knownToAll" | "revealedToAll" | "revealedTo">,
  zoneType: ZoneType | undefined,
  viewerId: PlayerId,
  viewerRole?: ViewerRole
) => {
  if (viewerRole === "spectator") return true;

  if (zoneType === ZONE.EXILE && card.faceDown) {
    if (card.knownToAll || card.revealedToAll) return true;
    return Boolean(card.revealedTo?.includes(viewerId));
  }

  if (card.ownerId === viewerId) return true;

  if (zoneType === ZONE.BATTLEFIELD && card.faceDown) {
    if (card.knownToAll) return true;
    if (card.revealedToAll) return true;
    if (card.revealedTo?.includes(viewerId)) return true;
    return canViewerPeekBattlefieldFaceDown(card, viewerId, viewerRole);
  }

  if (isHiddenZoneType(zoneType)) {
    if (card.knownToAll) return true;
    if (card.revealedToAll) return true;
    return Boolean(card.revealedTo?.includes(viewerId));
  }

  return true;
};

export const canManageFaceDownExileReveal = (params: {
  card: Pick<
    Card,
    | "ownerId"
    | "controllerId"
    | "faceDown"
    | "knownToAll"
    | "revealedToAll"
    | "revealedTo"
  >;
  zone: Pick<Zone, "type" | "ownerId">;
  viewerId: PlayerId;
  viewerRole?: ViewerRole;
}) => {
  if (
    params.viewerRole === "spectator" ||
    params.zone.type !== ZONE.EXILE ||
    !params.card.faceDown
  ) {
    return false;
  }

  return (
    params.zone.ownerId === params.viewerId ||
    canViewerSeeCardIdentity(
      params.card,
      params.zone.type,
      params.viewerId,
      params.viewerRole,
    )
  );
};

export const shouldRenderFaceDown = (
  card: Pick<Card, "faceDown" | "ownerId" | "controllerId" | "knownToAll" | "revealedToAll" | "revealedTo">,
  zoneType: ZoneType | undefined,
  viewerId: PlayerId,
  viewerRole?: ViewerRole
) => {
  if (zoneType === ZONE.BATTLEFIELD && card.faceDown) return true;
  if (zoneType === ZONE.EXILE && card.faceDown) {
    return !canViewerSeeCardIdentity(card, zoneType, viewerId, viewerRole);
  }
  if (isHiddenZoneType(zoneType)) {
    return !canViewerSeeCardIdentity(card, zoneType, viewerId, viewerRole);
  }
  return false;
};
