import { readBattlefieldAnchor } from "@mtg/shared/battlefieldAnchor";
import type { Maps } from "./types";
import {
  readPlayer,
  readZone,
  readLiveZoneCardIds,
  writePlayer,
} from "./yjsStore";

const hasBattlefieldCards = (maps: Maps, playerId: string) =>
  Array.from(maps.zones.keys()).some((id) => {
    const zone = readZone(maps, id);
    return (
      zone?.ownerId === playerId &&
      zone.type === "battlefield" &&
      readLiveZoneCardIds(maps, id, zone.cardIds).length > 0
    );
  });

// Capture before the mutation, then commit inside the same successful transaction.
export const prepareBattlefieldAnchors = (maps: Maps) =>
  Array.from(maps.players.keys()).flatMap((id) => {
    const player = readPlayer(maps, id);
    return player && !player.battlefieldCameraAnchor
      ? [
          {
            id,
            hadCards: hasBattlefieldCards(maps, id),
            epoch: player.battlefieldCameraEpoch ?? 0,
          },
        ]
      : [];
  });

export const establishBattlefieldAnchors = (
  maps: Maps,
  before: ReturnType<typeof prepareBattlefieldAnchors>,
  actorId: string,
  proposed: unknown,
) => {
  let changed = false;
  for (const entry of before) {
    const player = readPlayer(maps, entry.id);
    if (
      !player ||
      player.battlefieldCameraAnchor ||
      (player.battlefieldCameraEpoch ?? 0) !== entry.epoch
    )
      continue;
    if (!entry.hadCards && !hasBattlefieldCards(maps, entry.id)) continue;
    // Existing arrangements keep their original view. Only the owner may choose
    // a new anchor; someone else moving a card here cannot redirect this camera.
    const anchor =
      !entry.hadCards && actorId === entry.id
        ? readBattlefieldAnchor(proposed)
        : undefined;
    writePlayer(maps, {
      ...player,
      battlefieldCameraAnchor: anchor ?? { x: 0, y: 0 },
    });
    changed = true;
  }
  return changed;
};
