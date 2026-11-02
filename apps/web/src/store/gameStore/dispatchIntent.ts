import { m } from "@/paraglide/messages.js";
import type { StoreApi } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

import type { GameState } from "@/types";
import type { Intent, IntentAck } from "@/partykit/messages";
import { getIntentConnectionMeta, sendIntent } from "@/partykit/intentTransport";

export type DispatchIntentArgs = {
  type: string;
  payload: Record<string, unknown>;
  applyLocal?: (state: GameState) => Partial<GameState> | GameState;
  isRemote?: boolean;
  skipSend?: boolean;
  suppressDropToast?: boolean;
};

export type DispatchIntent = (args: DispatchIntentArgs) => string | null;

type PendingIntent = {
  id: string;
  applyLocal?: (state: GameState) => Partial<GameState> | GameState;
};

const pendingIntents: PendingIntent[] = [];
const acknowledgementWaiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();

// Actions expose their own intent ID, so awaiting an import never captures an
// unrelated action dispatched by another UI interaction.
export const waitForIntentAcknowledgement = (intentId: string | null | undefined): Promise<void> => {
  if (!intentId) return Promise.reject(new Error(m.dispatch_intent_connecting_to_multiplayer_please_try_again()));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      acknowledgementWaiters.delete(intentId);
      reject(new Error(m.dispatch_intent_the_server_did_not_confirm_the_deck_import_please_try_again()));
    }, 15_000);
    acknowledgementWaiters.set(intentId, {
      resolve: () => { clearTimeout(timer); resolve(); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
  });
};
let lastAuthoritativeState: GameState | null = null;
let lastPublicState: GameState | null = null;
let lastDropToastAt = 0;
let firstDropAt: number | null = null;

const DROP_TOAST_COOLDOWN_MS = 2000;
const INTENT_DROP_GRACE_MS = 10_000;
const INTENT_DISCONNECT_GRACE_MS = 4_000;

const shouldWarnIntentDropped = () => {
  const now = Date.now();
  const meta = getIntentConnectionMeta();
  if (meta.isOpen) {
    firstDropAt = null;
    return false;
  }
  if (meta.everConnected) {
    firstDropAt = null;
    if (meta.lastCloseAt && now - meta.lastCloseAt < INTENT_DISCONNECT_GRACE_MS) {
      return false;
    }
    return true;
  }
  if (firstDropAt === null) {
    firstDropAt = now;
    return false;
  }
  return now - firstDropAt >= INTENT_DROP_GRACE_MS;
};

const warnIntentDropped = () => {
  if (!shouldWarnIntentDropped()) return;
  const now = Date.now();
  if (now - lastDropToastAt < DROP_TOAST_COOLDOWN_MS) return;
  lastDropToastAt = now;
  toast.warning(m.dispatch_intent_reconnecting_to_multiplayer_please_wait_a_moment_then_try_again());
};

const applyLocalPatch = (
  state: GameState,
  applyLocal: PendingIntent["applyLocal"]
): GameState => {
  if (!applyLocal) return state;
  const patch = applyLocal(state);
  if (!patch || patch === state) return state;
  return { ...state, ...patch };
};

export const applyPendingIntents = (state: GameState): GameState => {
  let next = state;
  pendingIntents.forEach((pending) => {
    next = applyLocalPatch(next, pending.applyLocal);
  });
  return next;
};

export const setAuthoritativeState = (state: GameState, publicState?: GameState) => {
  lastAuthoritativeState = state;
  if (publicState) lastPublicState = publicState;
};

export const getAuthoritativeState = () => lastAuthoritativeState;

export const getPublicAuthoritativeState = () => lastPublicState;

export const resetIntentState = () => {
  acknowledgementWaiters.forEach((waiter) => waiter.reject(new Error(m.dispatch_intent_disconnected_during_deck_import_please_try_again())));
  acknowledgementWaiters.clear();
  pendingIntents.splice(0, pendingIntents.length);
  lastAuthoritativeState = null;
  lastPublicState = null;
  lastDropToastAt = 0;
  firstDropAt = null;
};

export const handleIntentAck = (
  ack: IntentAck,
  setState: StoreApi<GameState>["setState"]
): string | null => {
  const waiter = acknowledgementWaiters.get(ack.intentId);
  if (waiter) {
    acknowledgementWaiters.delete(ack.intentId);
    if (ack.ok) waiter.resolve();
    else waiter.reject(new Error(ack.error || m.dispatch_intent_deck_import_rejected()));
  }
  const index = pendingIntents.findIndex((pending) => pending.id === ack.intentId);
  if (index === -1) return null;
  pendingIntents.splice(index, 1);

  if (!ack.ok && lastAuthoritativeState) {
    const reconciled = applyPendingIntents(lastAuthoritativeState);
    setState(current => ({ ...reconciled, battlefieldViewScale: current.battlefieldViewScale, battlefieldGridSizing: current.battlefieldGridSizing }));
  }

  if (!ack.ok) {
    return ack.error || m.action_rejected();
  }

  return null;
};

export const createIntentDispatcher = (
  setState: StoreApi<GameState>["setState"],
  getState?: StoreApi<GameState>["getState"]
): DispatchIntent => {
  return ({
    type,
    payload,
    applyLocal,
    isRemote,
    skipSend,
    suppressDropToast,
  }) => {
    if (isRemote) {
      if (applyLocal) {
        setState(applyLocal);
      }
      return null;
    }

    const state = getState?.();
    const ownerId = state?.myPlayerId;
    const anchor = ownerId && !state.players[ownerId]?.battlefieldCameraAnchor
      ? state.battlefieldGridSizing[ownerId]?.startingAnchor : undefined;
    if (anchor && (payload.actorId === undefined || payload.actorId === ownerId)) payload = {...payload, battlefieldCameraAnchor: anchor};
    const intentId = uuidv4();
    if (!skipSend) {
      const intent: Intent = {
        id: intentId,
        type,
        payload,
      };
      const sent = sendIntent(intent);
      if (sent === false) {
        if (!suppressDropToast) {
          warnIntentDropped();
        }
        return null;
      }
    }

    pendingIntents.push({ id: intentId, applyLocal });
    if (applyLocal) {
      setState(applyLocal);
    }

    return intentId;
  };
};
