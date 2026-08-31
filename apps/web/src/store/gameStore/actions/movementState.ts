import type { Zone, ZoneId } from "@/types";

export type CardPlacement = "top" | "bottom";

export const removeCardId = (ids: string[], cardId: string): string[] =>
  ids.filter((id) => id !== cardId);

export const placeCardId = (
  ids: string[],
  cardId: string,
  placement: CardPlacement
): string[] => {
  const without = removeCardId(ids, cardId);
  return placement === "bottom" ? [cardId, ...without] : [...without, cardId];
};

export const placeCardIdFromTop = (
  ids: string[],
  cardId: string,
  requestedPosition: number
): string[] => {
  const without = removeCardId(ids, cardId);
  const positionFromTop = Math.max(
    1,
    Math.min(without.length + 1, Math.floor(requestedPosition))
  );
  const insertionIndex = without.length - positionFromTop + 1;
  return [
    ...without.slice(0, insertionIndex),
    cardId,
    ...without.slice(insertionIndex),
  ];
};

export const moveCardIdBetweenZones = (params: {
  zones: Record<ZoneId, Zone>;
  cardId: string;
  fromZoneId: ZoneId;
  toZoneId: ZoneId;
  placement: CardPlacement;
  positionFromTop?: number;
}): Record<ZoneId, Zone> => {
  const from = params.zones[params.fromZoneId];
  const to = params.zones[params.toZoneId];
  if (!from || !to) return params.zones;

  if (params.fromZoneId === params.toZoneId) {
    return {
      ...params.zones,
      [params.fromZoneId]: {
        ...from,
        cardIds:
          typeof params.positionFromTop === "number"
            ? placeCardIdFromTop(from.cardIds, params.cardId, params.positionFromTop)
            : placeCardId(from.cardIds, params.cardId, params.placement),
      },
    };
  }

  return {
    ...params.zones,
    [params.fromZoneId]: {
      ...from,
      cardIds: removeCardId(from.cardIds, params.cardId),
    },
    [params.toZoneId]: {
      ...to,
      cardIds:
        typeof params.positionFromTop === "number"
          ? placeCardIdFromTop(to.cardIds, params.cardId, params.positionFromTop)
          : placeCardId(to.cardIds, params.cardId, params.placement),
    },
  };
};

export const removeCardFromZones = (
  zones: Record<ZoneId, Zone>,
  cardId: string,
  zoneIds: ZoneId[]
): Record<ZoneId, Zone> => {
  const nextZones: Record<ZoneId, Zone> = { ...zones };

  zoneIds.forEach((zoneId) => {
    const zone = zones[zoneId];
    if (!zone) return;
    nextZones[zoneId] = { ...zone, cardIds: removeCardId(zone.cardIds, cardId) };
  });

  return nextZones;
};
