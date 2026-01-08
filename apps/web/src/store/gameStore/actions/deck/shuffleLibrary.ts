import type { GameState } from "@/types";

import { getZoneByType } from "@/lib/gameSelectors";
import { ZONE } from "@/constants/zones";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import {
  patchCard as yPatchCard,
  reorderZoneCards as yReorderZoneCards,
  sharedSnapshot,
} from "@/yjs/yMutations";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildHiddenOrderPayloads, buildLibraryTopRevealPayload } from "@/commandLog";

export const createShuffleLibrary =
  (
    set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["shuffleLibrary"] =>
  (playerId, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const state = get();
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    if (!libraryZone) return;

    const viewPermission = canViewZone({ actorId: actor, role }, libraryZone, {
      viewAll: true,
    });
    if (!viewPermission.allowed) {
      logPermission({
        action: "shuffleLibrary",
        actorId: actor,
        allowed: false,
        reason: viewPermission.reason,
        details: { playerId },
      });
      return;
    }

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const shuffledIds = [...libraryZone.cardIds].sort(() => Math.random() - 0.5);
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "library.shuffle",
          buildPayloads: async () => {
            const payloads = await buildHiddenOrderPayloads({
              sessionId: active.sessionId,
              ownerId: playerId,
              zoneType: libraryZone.type,
              order: shuffledIds,
            });
            return {
              payloadPublic: payloads.payloadPublic,
              payloadOwnerEnc: payloads.payloadOwnerEnc,
            };
          },
        });
        if (state.players[playerId]?.libraryTopReveal === "all") {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "library.topReveal.set",
            buildPayloads: () =>
              buildLibraryTopRevealPayload({
                ownerId: playerId,
                order: shuffledIds,
                cardsById: state.cards,
              }),
          });
        }
        logPermission({
          action: "shuffleLibrary",
          actorId: actor,
          allowed: true,
          details: { playerId },
        });
        emitLog("library.shuffle", { actorId: actor, playerId }, buildLogContext());
        return;
      }
    }

    const sharedApplied = applyShared((maps) => {
      const snapshot = sharedSnapshot(maps);
      const zone = snapshot.zones[libraryZone.id];
      if (!zone) return;
      const shuffledIds = [...zone.cardIds].sort(() => Math.random() - 0.5);
      yReorderZoneCards(maps, libraryZone.id, shuffledIds);
      zone.cardIds.forEach((id) => {
        yPatchCard(maps, id, { knownToAll: false, revealedToAll: false, revealedTo: [] });
      });
    });

    if (!sharedApplied) {
      set((state) => {
        const shuffledIds = [...(state.zones[libraryZone.id]?.cardIds || [])].sort(
          () => Math.random() - 0.5
        );
        const cardsCopy = { ...state.cards };
        shuffledIds.forEach((id) => {
          const card = cardsCopy[id];
          if (!card) return;
          cardsCopy[id] = {
            ...card,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
          };
        });

        return {
          cards: cardsCopy,
          zones: {
            ...state.zones,
            [libraryZone.id]: { ...state.zones[libraryZone.id], cardIds: shuffledIds },
          },
        };
      });
    }

    logPermission({
      action: "shuffleLibrary",
      actorId: actor,
      allowed: true,
      details: { playerId },
    });

    emitLog("library.shuffle", { actorId: actor, playerId }, buildLogContext());
  };
