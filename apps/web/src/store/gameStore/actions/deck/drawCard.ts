import type { Card, GameState } from "@/types";

import { getZoneByType } from "@/lib/gameSelectors";
import { ZONE } from "@/constants/zones";
import { canMoveCard } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildLibraryTopRevealPayload } from "@/commandLog";
import { getSessionAccessKeys } from "@/lib/sessionKeys";
import { base64UrlToBytes } from "@/crypto/base64url";
import { deriveOwnerAesKey, deriveSpectatorAesKey, encryptJsonPayload } from "@/commandLog/crypto";
import { getSessionIdentityBytes } from "@/lib/sessionIdentity";

export const createDrawCard =
  (_set: SetState, get: GetState, { buildLogContext }: Deps): GameState["drawCard"] =>
  (playerId, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const state = get();
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    const handZone = getZoneByType(state.zones, playerId, ZONE.HAND);

    if (!libraryZone || !handZone || libraryZone.cardIds.length === 0) return;

    const cardId = libraryZone.cardIds[libraryZone.cardIds.length - 1];
    const card = state.cards[cardId];
    if (!card) return;

    const permission = canMoveCard({
      actorId: actor,
      role,
      card,
      fromZone: libraryZone,
      toZone: handZone,
    });
    if (!permission.allowed) {
      logPermission({
        action: "drawCard",
        actorId: actor,
        allowed: false,
        reason: permission.reason,
        details: { playerId, cardId },
      });
      return;
    }

    logPermission({
      action: "drawCard",
      actorId: actor,
      allowed: true,
      details: { playerId, cardId },
    });
    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const drawnIds = libraryZone.cardIds.slice(-1);
        const nextLibraryOrder = libraryZone.cardIds.slice(0, libraryZone.cardIds.length - drawnIds.length);
        const nextHandOrder = [...handZone.cardIds, ...drawnIds];
        const handCards = nextHandOrder
          .map((id) => state.cards[id])
          .filter((c): c is Card => Boolean(c))
          .map((c) => ({ ...c, zoneId: handZone.id }));

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.draw",
          buildPayloads: async () => {
            const identityBytes = getSessionIdentityBytes(active.sessionId);
            const ownerKey = deriveOwnerAesKey({
              ownerKey: identityBytes.ownerKey,
              sessionId: active.sessionId,
            });
            const payloadOwnerEnc = await encryptJsonPayload(ownerKey, {
              hand: handCards,
              order: nextLibraryOrder,
            });

            let payloadSpectatorEnc: string | undefined;
            const keys = getSessionAccessKeys(active.sessionId);
            if (keys.spectatorKey) {
              const spectatorKey = deriveSpectatorAesKey({
                spectatorKey: base64UrlToBytes(keys.spectatorKey),
                sessionId: active.sessionId,
              });
              payloadSpectatorEnc = await encryptJsonPayload(spectatorKey, {
                hand: handCards,
              });
            }

            return {
              payloadPublic: { ownerId: playerId, count: drawnIds.length },
              payloadOwnerEnc,
              payloadSpectatorEnc,
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
                order: nextLibraryOrder,
                cardsById: state.cards,
              }),
          });
        }

        emitLog("card.draw", { actorId: actor, playerId, count: 1 }, buildLogContext());
        return;
      }
    }

    state.moveCard(cardId, handZone.id, undefined, actor, undefined, {
      suppressLog: true,
    });

    emitLog("card.draw", { actorId: actor, playerId, count: 1 }, buildLogContext());
  };
