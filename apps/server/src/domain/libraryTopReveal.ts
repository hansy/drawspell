import type { LibraryTopRevealMode } from "@mtg/shared/types/players";
import {
  libraryTopRevealIncludesPlayer,
  libraryTopRevealSelectedIds,
} from "@mtg/shared/types/players";

import type { HiddenReveal, Maps } from "./types";

export const buildLibraryTopRevealScope = (
  maps: Maps,
  ownerId: string,
  mode?: LibraryTopRevealMode | null,
): HiddenReveal | undefined => {
  const allPlayerIds: string[] = [];
  maps.players.forEach((_value, key) => {
    allPlayerIds.push(String(key));
  });
  const toPlayers = libraryTopRevealSelectedIds(mode, ownerId, allPlayerIds);

  return toPlayers.length ? { toPlayers } : undefined;
};

export const canViewerSeeLibraryTopForMode = (params: {
  viewerId?: string;
  viewerRole?: "player" | "spectator";
  ownerId: string;
  mode?: LibraryTopRevealMode | null;
}) => {
  return libraryTopRevealIncludesPlayer(
    params.mode,
    params.viewerId,
    params.ownerId,
    params.viewerRole,
  );
};
