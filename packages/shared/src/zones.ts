import { LEGACY_COMMAND_ZONE, ZONE, isCommanderZoneType } from "./constants/zones";
import type { Card } from "./types/cards";
import type { PlayerId } from "./types/ids";
import type { Zone, ZoneType } from "./types/zones";

type ZoneMatchCandidate = Pick<Zone, "ownerId"> & {
  type: ZoneType | typeof LEGACY_COMMAND_ZONE;
};

export const zoneMatchesOwnerAndType = (
  zone: ZoneMatchCandidate,
  ownerId: PlayerId,
  zoneType: ZoneType
) =>
  zone.ownerId === ownerId &&
  (zoneType === ZONE.COMMANDER
    ? isCommanderZoneType(zone.type)
    : zone.type === zoneType);

export const findZoneByType = (
  zones: Record<string, Zone>,
  ownerId: PlayerId,
  zoneType: ZoneType
): Zone | undefined =>
  Object.values(zones).find((zone) =>
    zoneMatchesOwnerAndType(zone, ownerId, zoneType)
  );

export const getPlayerZones = (
  zones: Record<string, Zone>,
  ownerId: PlayerId
): Record<ZoneType, Zone | undefined> => ({
  library: findZoneByType(zones, ownerId, ZONE.LIBRARY),
  hand: findZoneByType(zones, ownerId, ZONE.HAND),
  battlefield: findZoneByType(zones, ownerId, ZONE.BATTLEFIELD),
  graveyard: findZoneByType(zones, ownerId, ZONE.GRAVEYARD),
  exile: findZoneByType(zones, ownerId, ZONE.EXILE),
  commander: findZoneByType(zones, ownerId, ZONE.COMMANDER),
  sideboard: findZoneByType(zones, ownerId, ZONE.SIDEBOARD),
});

export const getCardsInZone = <TCard extends Pick<Card, "id"> = Card>(
  cards: Record<string, TCard | undefined>,
  zone?: Pick<Zone, "cardIds">
): TCard[] => {
  if (!zone) return [];
  return zone.cardIds
    .map((id) => cards[id])
    .filter((card): card is TCard => Boolean(card));
};
