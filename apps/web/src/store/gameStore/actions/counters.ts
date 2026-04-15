import { normalizeCounterType } from "@mtg/shared/counters";
import type { StoreApi } from "zustand";

import type { GameState } from "@/types";
import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";

import { canModifyCardState } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import {
  decrementCounter,
  isBattlefieldZone,
  mergeCounters,
  resolveCounterColor,
} from "@/lib/counters";

type SetState = StoreApi<GameState>["setState"];
type GetState = StoreApi<GameState>["getState"];

type Deps = {
  dispatchIntent: DispatchIntent;
};

const getNormalizedCounterTotal = (
  counters: GameState["cards"][string]["counters"],
  counterType: string
) =>
  counters.reduce((sum, counter) => {
    return normalizeCounterType(counter.type) === counterType
      ? sum + counter.count
      : sum;
  }, 0);

const resolveCardCounterContext = (
  get: GetState,
  cardId: string,
  counterType: string,
  actorId: string | undefined,
  action: "addCounterToCard" | "removeCounterFromCard",
) => {
  const state = get();
  const card = state.cards[cardId];
  if (!card) return null;

  const actor = actorId ?? state.myPlayerId;
  const role = actor === state.myPlayerId ? state.viewerRole : "player";
  const zone = state.zones[card.zoneId];
  if (!isBattlefieldZone(zone)) return null;

  const permission = canModifyCardState({ actorId: actor, role }, card, zone);
  if (!permission.allowed) {
    logPermission({
      action,
      actorId: actor,
      allowed: false,
      reason: permission.reason,
      details: { cardId, zoneId: card.zoneId, counterType },
    });
    return null;
  }

  return { card, actor };
};

export const createCounterActions = (
  _set: SetState,
  get: GetState,
  { dispatchIntent }: Deps
): Pick<
  GameState,
  "addGlobalCounter" | "addCounterToCard" | "removeCounterFromCard"
> => ({
  addGlobalCounter: (name: string, color?: string, _isRemote?: boolean) => {
    if (get().viewerRole === "spectator") return;
    const normalizedName = normalizeCounterType(name);
    if (!normalizedName) return;

    const existing = Object.keys(get().globalCounters).find(
      (counterType) => normalizeCounterType(counterType) === normalizedName
    );
    if (existing) return;

    const resolvedColor = resolveCounterColor(normalizedName, get().globalCounters);
    const normalizedColor = (color || resolvedColor).slice(0, 16);

    dispatchIntent({
      type: "counter.global.add",
      payload: {
        counterType: normalizedName,
        color: normalizedColor,
        actorId: get().myPlayerId,
      },
      applyLocal: (state) => {
        return {
          globalCounters: { ...state.globalCounters, [normalizedName]: normalizedColor },
        };
      },
      isRemote: _isRemote,
    });
  },

  addCounterToCard: (cardId, counter, actorId, _isRemote) => {
    const normalizedType = normalizeCounterType(counter.type);
    if (!normalizedType) return;

    const context = resolveCardCounterContext(
      get,
      cardId,
      normalizedType,
      actorId,
      "addCounterToCard",
    );
    if (!context) return;

    const { card, actor } = context;
    const normalizedCounter = { ...counter, type: normalizedType };
    const prevCount = getNormalizedCounterTotal(card.counters, normalizedType);
    const newCounters = mergeCounters(card.counters, normalizedCounter);
    const nextCount = getNormalizedCounterTotal(newCounters, normalizedType);
    const delta = nextCount - prevCount;
    if (delta <= 0) return;

    dispatchIntent({
      type: "card.counter.adjust",
      payload: { cardId, counter: normalizedCounter, actorId: actor },
      applyLocal: (current) => {
        const currentCard = current.cards[cardId];
        if (!currentCard) return current;
        return {
          cards: {
            ...current.cards,
            [cardId]: {
              ...currentCard,
              counters: newCounters,
            },
          },
        };
      },
      isRemote: _isRemote,
    });

    logPermission({
      action: "addCounterToCard",
      actorId: actor,
      allowed: true,
      details: { cardId, zoneId: card.zoneId, counterType: normalizedType, delta },
    });
  },

  removeCounterFromCard: (cardId, counterType, actorId, _isRemote) => {
    const normalizedType = normalizeCounterType(counterType);
    if (!normalizedType) return;

    const context = resolveCardCounterContext(
      get,
      cardId,
      normalizedType,
      actorId,
      "removeCounterFromCard",
    );
    if (!context) return;

    const { card, actor } = context;
    const prevCount = getNormalizedCounterTotal(card.counters, normalizedType);
    const newCounters = decrementCounter(card.counters, normalizedType);
    const nextCount = getNormalizedCounterTotal(newCounters, normalizedType);
    const delta = nextCount - prevCount;
    if (delta === 0) return;

    dispatchIntent({
      type: "card.counter.adjust",
      payload: { cardId, counterType: normalizedType, actorId: actor, delta },
      applyLocal: (current) => {
        const currentCard = current.cards[cardId];
        if (!currentCard) return current;
        return {
          cards: {
            ...current.cards,
            [cardId]: {
              ...currentCard,
              counters: newCounters,
            },
          },
        };
      },
      isRemote: _isRemote,
    });

    logPermission({
      action: "removeCounterFromCard",
      actorId: actor,
      allowed: true,
      details: { cardId, zoneId: card.zoneId, counterType: normalizedType, delta },
    });
  },
});
