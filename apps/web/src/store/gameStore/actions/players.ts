import {
  MAX_FLOATING_MANA_PER_TYPE,
  normalizeManaPool,
  type GameState,
} from "@/types";
import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";
import type { GetState, SetState } from "./types";
import { MAX_PLAYER_LIFE, MIN_PLAYER_LIFE } from "@/lib/limits";

import { canUpdatePlayer } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";

type Deps = {
  dispatchIntent: DispatchIntent;
};

const clampLife = (life: number) =>
  Math.min(MAX_PLAYER_LIFE, Math.max(MIN_PLAYER_LIFE, life));

export const createPlayerActions = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps
): Pick<
  GameState,
  "addPlayer" | "updatePlayer" | "adjustMana" | "clearMana" | "setDeckLoaded"
> => ({
  addPlayer: (player, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    const normalized = {
      ...player,
      deckLoaded: false,
      commanderTax: 0,
      manaPool: normalizeManaPool(player.manaPool),
    };
    dispatchIntent({
      type: "player.join",
      payload: { player: normalized },
      applyLocal: (state) => ({
        players: { ...state.players, [normalized.id]: normalized },
        playerOrder: state.playerOrder.includes(normalized.id)
          ? state.playerOrder
          : [...state.playerOrder, normalized.id],
      }),
      isRemote: _isRemote,
    });
  },

  updatePlayer: (id, updates, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const player = get().players[id];
    if (!player) return;

    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.manaPool;
    if ("life" in normalizedUpdates) {
      const nextLife = normalizedUpdates.life;
      if (typeof nextLife !== "number" || !Number.isFinite(nextLife)) {
        delete normalizedUpdates.life;
      } else {
        normalizedUpdates.life = clampLife(nextLife);
      }
    }
    if (Object.keys(normalizedUpdates).length === 0) return;

    const permission = canUpdatePlayer(
      { actorId: actor, role },
      player,
      normalizedUpdates
    );
    if (!permission.allowed) {
      logPermission({
        action: "updatePlayer",
        actorId: actor,
        allowed: false,
        reason: permission.reason,
        details: { playerId: id, updates: normalizedUpdates },
      });
      return;
    }
    logPermission({
      action: "updatePlayer",
      actorId: actor,
      allowed: true,
      details: { playerId: id, updates: normalizedUpdates },
    });

    dispatchIntent({
      type: "player.update",
      payload: { playerId: id, updates: normalizedUpdates, actorId: actor },
      applyLocal: (state) => ({
        players: {
          ...state.players,
          [id]: { ...state.players[id], ...normalizedUpdates },
        },
      }),
      isRemote: _isRemote,
    });
  },

  adjustMana: (playerId, manaType, delta, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    if (get().viewerRole === "spectator" || actor !== playerId) return;
    if (!get().players[playerId]) return;

    dispatchIntent({
      type: "player.mana.adjust",
      payload: { playerId, manaType, delta, actorId: actor },
      applyLocal: (state) => {
        const player = state.players[playerId];
        if (!player) return state;
        const manaPool = normalizeManaPool(player.manaPool);
        const nextAmount = Math.min(
          MAX_FLOATING_MANA_PER_TYPE,
          Math.max(0, (manaPool[manaType] ?? 0) + delta),
        );
        const nextManaPool = { ...manaPool };
        if (nextAmount > 0) nextManaPool[manaType] = nextAmount;
        else delete nextManaPool[manaType];
        return {
          players: {
            ...state.players,
            [playerId]: { ...player, manaPool: nextManaPool },
          },
        };
      },
      isRemote: _isRemote,
    });
  },

  clearMana: (playerId, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    if (get().viewerRole === "spectator" || actor !== playerId) return;
    if (!get().players[playerId]) return;

    dispatchIntent({
      type: "player.mana.clear",
      payload: { playerId, actorId: actor },
      applyLocal: (state) => {
        const player = state.players[playerId];
        if (!player) return state;
        return {
          players: {
            ...state.players,
            [playerId]: { ...player, manaPool: {} },
          },
        };
      },
      isRemote: _isRemote,
    });
  },

  setDeckLoaded: (playerId, loaded, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    const actorId = get().myPlayerId;
    dispatchIntent({
      type: loaded ? "deck.load" : "deck.unload",
      payload: { playerId, actorId },
      applyLocal: (state) => ({
        players: {
          ...state.players,
          [playerId]: { ...state.players[playerId], deckLoaded: loaded },
        },
      }),
      isRemote: _isRemote,
    });
  },
});
