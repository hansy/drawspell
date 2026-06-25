import type { SharedMaps } from './shared';

export type RoomMetaPatch = {
  hostId?: string | null;
};

export const patchRoomMeta = (maps: SharedMaps, patch: RoomMetaPatch) => {
  if (patch.hostId !== undefined) {
    if (patch.hostId === null || patch.hostId === '') {
      maps.meta.delete('hostId');
    } else {
      maps.meta.set('hostId', patch.hostId);
    }
  }
};
