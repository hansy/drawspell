import type { Card, GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { getZoneByType } from "@/lib/gameSelectors";
import { emitLog } from "@/logging/logStore";
import { canMoveCard } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";

import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildHiddenZonePayloads, buildLibraryTopRevealPayload } from "@/commandLog";

export const createDiscardFromLibrary = (
  _set: SetState,
  get: GetState,
  { buildLogContext }: Deps
): GameState["discardFromLibrary"] =>
  (playerId, count = 1, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const normalizedCount = Math.max(1, Math.floor(count));

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const state = get();
        const role = actor === state.myPlayerId ? state.viewerRole : "player";
        const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
        const graveyardZone = getZoneByType(state.zones, playerId, ZONE.GRAVEYARD);
        if (!libraryZone || !graveyardZone || libraryZone.cardIds.length === 0) return;

        const discardIds = libraryZone.cardIds.slice(-normalizedCount);
        const remainingOrder = libraryZone.cardIds.slice(0, libraryZone.cardIds.length - discardIds.length);
        const remainingCards = remainingOrder
          .map((id) => state.cards[id])
          .filter((c): c is Card => Boolean(c));

        const sampleId = discardIds[discardIds.length - 1];
        const sampleCard = sampleId ? state.cards[sampleId] : undefined;
        if (!sampleCard) return;
        const permission = canMoveCard({
          actorId: actor,
          role,
          card: sampleCard,
          fromZone: libraryZone,
          toZone: graveyardZone,
        });
        if (!permission.allowed) {
          logPermission({
            action: "discardFromLibrary",
            actorId: actor,
            allowed: false,
            reason: permission.reason,
            details: { playerId, cardId: sampleId },
          });
          return;
        }
        logPermission({
          action: "discardFromLibrary",
          actorId: actor,
          allowed: true,
          details: { playerId, cardId: sampleId },
        });

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "zone.set.hidden",
          buildPayloads: async () => {
            const payloads = await buildHiddenZonePayloads({
              sessionId: active.sessionId,
              ownerId: playerId,
              zoneType: ZONE.LIBRARY,
              cards: remainingCards,
              order: remainingOrder,
            });
            return {
              payloadPublic: payloads.payloadPublic,
              payloadOwnerEnc: payloads.payloadOwnerEnc,
              payloadSpectatorEnc: payloads.payloadSpectatorEnc,
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
                order: remainingOrder,
                cardsById: state.cards,
              }),
          });
        }

        discardIds.forEach((id) => {
          const card = state.cards[id];
          if (!card) return;
          const publicCard = {
            ...card,
            zoneId: graveyardZone.id,
            knownToAll: true,
          };
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "card.create.public",
            buildPayloads: () => ({
              payloadPublic: { card: publicCard },
            }),
          });
        });

        emitLog("card.discard", { actorId: actor, playerId, count: discardIds.length }, buildLogContext());
        return;
      }
    }

    let movedCount = 0;
    for (let i = 0; i < normalizedCount; i++) {
      const state = get();
      const role = actor === state.myPlayerId ? state.viewerRole : "player";
      const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
      const graveyardZone = getZoneByType(state.zones, playerId, ZONE.GRAVEYARD);

      if (!libraryZone || !graveyardZone || libraryZone.cardIds.length === 0) break;

      const cardId = libraryZone.cardIds[libraryZone.cardIds.length - 1];
      const card = state.cards[cardId];
      if (!card) break;

      const permission = canMoveCard({
        actorId: actor,
        role,
        card,
        fromZone: libraryZone,
        toZone: graveyardZone,
      });

      if (!permission.allowed) {
        logPermission({
          action: "discardFromLibrary",
          actorId: actor,
          allowed: false,
          reason: permission.reason,
          details: { playerId, cardId },
        });
        break;
      }

      logPermission({
        action: "discardFromLibrary",
        actorId: actor,
        allowed: true,
        details: { playerId, cardId },
      });

      state.moveCard(cardId, graveyardZone.id, undefined, actor, undefined, { suppressLog: true });
      movedCount += 1;
    }

    if (movedCount > 0) {
      emitLog("card.discard", { actorId: actor, playerId, count: movedCount }, buildLogContext());
    }
  };
