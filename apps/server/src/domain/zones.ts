import {
  findZoneByType as findSnapshotZoneByType,
  zoneMatchesOwnerAndType,
} from "@mtg/shared/zones";
import type { Zone, ZoneType } from "@mtg/shared/types/zones";

import type { Maps } from "./types";
import { readRecord, readZone } from "./yjsStore";

export const findZoneByType = (
  zones: Record<string, Zone>,
  playerId: string,
  zoneType: ZoneType
): Zone | null => {
  const match = findSnapshotZoneByType(zones, playerId, zoneType);
  return match ? { ...match } : null;
};

export const findZoneByTypeInMaps = (
  maps: Maps,
  playerId: string,
  zoneType: ZoneType
): Zone | null => {
  let matchId: string | null = null;
  maps.zones.forEach((value, key) => {
    if (matchId) return;
    const raw = readRecord(value);
    if (!raw) return;
    const zone = raw as unknown as Zone;
    if (!zoneMatchesOwnerAndType(zone, playerId, zoneType)) return;
    matchId = String(key);
  });
  if (!matchId) return null;
  return readZone(maps, matchId);
};
