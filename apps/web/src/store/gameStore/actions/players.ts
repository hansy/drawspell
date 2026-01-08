import type { StoreApi } from "zustand";

import type { GameState } from "@/types";
import type { SharedMaps } from "@/yjs/yMutations";

import { canUpdatePlayer } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import { patchPlayer as yPatchPlayer, upsertPlayer as yUpsertPlayer } from "@/yjs/yMutations";
import type { LogContext } from "@/logging/types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";
import { ZONE } from "@/constants/zones";

type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

type ApplyShared = (fn: (maps: SharedMaps) => void) => boolean;

type Deps = {
  applyShared: ApplyShared;
  buildLogContext: () => LogContext;
};

export const createPlayerActions = (
  set: SetState,
  get: GetState,
  { applyShared, buildLogContext }: Deps
): Pick<
  GameState,
  "addPlayer" | "updatePlayer" | "updateCommanderTax" | "setDeckLoaded"
> => ({
  addPlayer: (player, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    const normalized = { ...player, deckLoaded: false, commanderTax: 0 };
    if (applyShared((maps) => yUpsertPlayer(maps, normalized))) return;
    set((state) => ({
      players: { ...state.players, [normalized.id]: normalized },
      playerOrder: state.playerOrder.includes(normalized.id)
        ? state.playerOrder
        : [...state.playerOrder, normalized.id],
    }));
  },

  updatePlayer: (id, updates, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const player = get().players[id];
    if (!player) return;

    const permission = canUpdatePlayer({ actorId: actor, role }, player, updates);
    if (!permission.allowed) {
      logPermission({
        action: "updatePlayer",
        actorId: actor,
        allowed: false,
        reason: permission.reason,
        details: { playerId: id, updates },
      });
      return;
    }
    logPermission({
      action: "updatePlayer",
      actorId: actor,
      allowed: true,
      details: { playerId: id, updates },
    });

    if (typeof updates.life === "number" && updates.life !== player.life) {
      emitLog(
        "player.life",
        {
          actorId: actor,
          playerId: id,
          from: player.life,
          to: updates.life,
          delta: updates.life - player.life,
        },
        buildLogContext()
      );
    }

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const hasLibraryTopReveal = Object.prototype.hasOwnProperty.call(
          updates,
          "libraryTopReveal",
        );
        const { libraryTopReveal, ...rest } = updates as typeof updates & {
          libraryTopReveal?: string | null;
        };

        if (hasLibraryTopReveal) {
          const state = get();
          const libraryZone = Object.values(state.zones).find(
            (zone) => zone.ownerId === id && zone.type === ZONE.LIBRARY,
          );
          const topId = libraryZone?.cardIds?.[libraryZone.cardIds.length - 1];
          const topCard = topId ? state.cards[topId] : undefined;
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "library.topReveal.set",
            buildPayloads: () => ({
              payloadPublic: {
                ownerId: id,
                mode:
                  libraryTopReveal === "self" || libraryTopReveal === "all"
                    ? libraryTopReveal
                    : null,
                cardId:
                  libraryTopReveal === "all" && topCard ? topCard.id : undefined,
                identity:
                  libraryTopReveal === "all" && topCard
                    ? {
                        name: topCard.name,
                        imageUrl: topCard.imageUrl,
                        oracleText: topCard.oracleText,
                        typeLine: topCard.typeLine,
                        scryfallId: topCard.scryfallId,
                        scryfall: topCard.scryfall,
                        isToken: topCard.isToken,
                        power: topCard.power,
                        toughness: topCard.toughness,
                        basePower: topCard.basePower,
                        baseToughness: topCard.baseToughness,
                        customText: topCard.customText,
                        currentFaceIndex: topCard.currentFaceIndex,
                        isCommander: topCard.isCommander,
                        commanderTax: topCard.commanderTax,
                      }
                    : undefined,
              },
            }),
          });
        }

        if (Object.keys(rest).length > 0) {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "player.update",
            buildPayloads: () => ({
              payloadPublic: { playerId: id, ...rest },
            }),
          });
        }
        return;
      }
    }

    if (
      applyShared((maps) => {
        yPatchPlayer(maps, id, updates);
      })
    )
      return;

    set((state) => ({
      players: {
        ...state.players,
        [id]: { ...state.players[id], ...updates },
      },
    }));
  },

  updateCommanderTax: (playerId, delta, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const player = get().players[playerId];
    if (!player) return;
    if (role === "spectator") {
      logPermission({
        action: "updateCommanderTax",
        actorId: actor,
        allowed: false,
        reason: "Spectators cannot update players",
        details: { playerId, delta },
      });
      return;
    }
    if (actor !== playerId) {
      logPermission({
        action: "updateCommanderTax",
        actorId: actor,
        allowed: false,
        reason: "Only the player may change their commander tax",
        details: { playerId, delta },
      });
      return;
    }

    const from = player.commanderTax || 0;
    const to = Math.max(0, from + delta);

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "player.update",
          buildPayloads: () => ({
            payloadPublic: { playerId, commanderTax: to },
          }),
        });
        return;
      }
    }

    if (
      applyShared((maps) => {
        yPatchPlayer(maps, playerId, { commanderTax: to });
      })
    )
      return;

    set((state) => {
      const current = state.players[playerId];
      if (!current) return state;
      return {
        players: {
          ...state.players,
          [playerId]: { ...current, commanderTax: to },
        },
      };
    });

    logPermission({
      action: "updateCommanderTax",
      actorId: actor,
      allowed: true,
      details: { playerId, delta },
    });
    emitLog(
      "player.commanderTax",
      { actorId: actor, playerId, from, to, delta: to - from },
      buildLogContext()
    );
  },

  setDeckLoaded: (playerId, loaded, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "player.update",
          buildPayloads: () => ({
            payloadPublic: { playerId, deckLoaded: loaded },
          }),
        });
        return;
      }
    }

    if (
      applyShared((maps) => {
        yPatchPlayer(maps, playerId, { deckLoaded: loaded });
      })
    )
      return;

    set((state) => ({
      players: {
        ...state.players,
        [playerId]: { ...state.players[playerId], deckLoaded: loaded },
      },
    }));
  },
});
