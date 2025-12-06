/**
 * Re-exports from docManager for backwards compatibility.
 * New code should import from docManager directly.
 */

export {
  // Session management
  acquireSession,
  releaseSession,
  destroySession,
  cleanupStaleSessions,
  
  // Provider/Awareness management  
  setSessionProvider,
  getSessionProvider,
  setSessionAwareness,
  getSessionAwareness,
  
  // Active session
  setActiveSession,
  getActiveSessionId,
  getActiveHandles,
  getSessionHandles,
  
  // Mutations
  runMutation,
  batchMutations,
  flushPendingMutations,
  
  // Legacy compatibility aliases
  getYDocHandles,
  setYDocHandles,
  getYProvider,
  setYProvider,
  runWithSharedDoc,
  batchSharedMutations,
  flushPendingSharedMutations,
} from './docManager';
