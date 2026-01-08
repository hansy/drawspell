import type { Card, GameState } from "@/types";

import { getZoneByType } from "@/lib/gameSelectors";
import { ZONE } from "@/constants/zones";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import { unloadDeck as yUnloadDeck } from "@/yjs/yMutations";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildHiddenZonePayloads } from "@/commandLog";

export const createUnloadDeck =
  (
    set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["unloadDeck"] =>
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
        action: "unloadDeck",
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
        const current = get();
        const publicOwned = Object.values(current.cards).filter((card) => {
          const zone = current.zones[card.zoneId];
          if (!zone) return false;
          const isHidden = zone.type === ZONE.HAND || zone.type === ZONE.LIBRARY || zone.type === ZONE.SIDEBOARD;
          return card.ownerId === playerId && !isHidden;
        });

        publicOwned.forEach((ownedCard) => {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "card.remove.public",
            buildPayloads: () => ({ payloadPublic: { cardId: ownedCard.id } }),
          });
        });

        const hiddenZones = [
          getZoneByType(current.zones, playerId, ZONE.LIBRARY),
          getZoneByType(current.zones, playerId, ZONE.HAND),
          getZoneByType(current.zones, playerId, ZONE.SIDEBOARD),
        ].filter((zone): zone is NonNullable<typeof zone> => Boolean(zone));

        hiddenZones.forEach((zone) => {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "zone.set.hidden",
            buildPayloads: async () => {
              const payloads = await buildHiddenZonePayloads({
                sessionId: active.sessionId,
                ownerId: playerId,
                zoneType: zone.type,
                cards: [] as Card[],
                order: [],
              });
              return {
                payloadPublic: payloads.payloadPublic,
                payloadOwnerEnc: payloads.payloadOwnerEnc,
                payloadSpectatorEnc: payloads.payloadSpectatorEnc,
              };
            },
          });
        });

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "library.topReveal.set",
          buildPayloads: () => ({
            payloadPublic: { ownerId: playerId, mode: null },
          }),
        });

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "player.update",
          buildPayloads: () => ({
            payloadPublic: { playerId, deckLoaded: false },
          }),
        });

        logPermission({
          action: "unloadDeck",
          actorId: actor,
          allowed: true,
          details: { playerId },
        });
        emitLog("deck.unload", { actorId: actor, playerId }, buildLogContext());
        return;
      }
    }

    const sharedApplied = applyShared((maps) => {
      yUnloadDeck(maps, playerId);
    });

    if (!sharedApplied) {
      set((current) => {
        const nextCards = { ...current.cards };
        const nextZones: typeof current.zones = {};

        const removeIds = new Set(
          Object.values(current.cards)
            .filter((card) => card.ownerId === playerId)
            .map((card) => card.id)
        );

        Object.values(current.zones).forEach((zone) => {
          const filteredIds = zone.cardIds.filter((id) => !removeIds.has(id));
          nextZones[zone.id] = { ...zone, cardIds: filteredIds };
        });

        removeIds.forEach((id) => {
          Reflect.deleteProperty(nextCards, id);
        });

        const nextPlayers = current.players[playerId]
          ? {
              ...current.players,
              [playerId]: {
                ...current.players[playerId],
                deckLoaded: false,
                libraryTopReveal: undefined,
              },
            }
          : current.players;

        return { cards: nextCards, zones: nextZones, players: nextPlayers };
      });
    }

    logPermission({
      action: "unloadDeck",
      actorId: actor,
      allowed: true,
      details: { playerId },
    });
    emitLog("deck.unload", { actorId: actor, playerId }, buildLogContext());
  };
