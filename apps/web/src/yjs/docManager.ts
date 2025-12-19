/**
 * Module-level Y.Doc manager - decoupled from React lifecycle.
 *
 * This solves the React double-mount issue by keeping Y.Docs at module scope,
 * keyed by sessionId. The docs survive React's StrictMode unmount/remount cycle.
 */

import type { WebsocketProvider } from "y-websocket";

import type { YDocHandles } from "./yDoc";

import {
  getActiveHandles,
  getActiveSessionId,
  getSessionProvider,
  setSessionProvider,
} from "./docManager/sessionStore";
import { batchMutations, flushPendingMutations, runMutation } from "./docManager/mutationQueue";

export {
  acquireSession,
  cleanupStaleSessions,
  destroySession,
  getActiveHandles,
  getActiveSessionId,
  getSessionAwareness,
  getSessionHandles,
  getSessionProvider,
  releaseSession,
  setActiveSession,
  setSessionAwareness,
  setSessionProvider,
} from "./docManager/sessionStore";

export { batchMutations, flushPendingMutations, runMutation } from "./docManager/mutationQueue";

// Compatibility exports for existing code
export const getYDocHandles = getActiveHandles;
export const setYDocHandles = (_handles: YDocHandles | null) => {
  // Legacy - now handled by acquireSession/setActiveSession
};
export const getYProvider = () => {
  const sessionId = getActiveSessionId();
  return sessionId ? getSessionProvider(sessionId) : null;
};
export const setYProvider = (provider: WebsocketProvider | null) => {
  const sessionId = getActiveSessionId();
  if (sessionId) setSessionProvider(sessionId, provider);
};
export const runWithSharedDoc = runMutation;
export const batchSharedMutations = batchMutations;
export const flushPendingSharedMutations = flushPendingMutations;
