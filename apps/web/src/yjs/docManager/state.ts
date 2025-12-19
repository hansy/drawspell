import type { Awareness } from "y-protocols/awareness";
import type { WebsocketProvider } from "y-websocket";

import type { YDocHandles } from "../yDoc";
import type { SharedMaps } from "../yMutations";

export interface SessionState {
  handles: YDocHandles;
  provider: WebsocketProvider | null;
  awareness: Awareness | null;
  refCount: number;
  lastAccess: number;
}

export const DEFAULT_SESSION_KEY = "__default__";

export const docManagerState = {
  sessions: new Map<string, SessionState>(),
  pendingMutations: new Map<string, Array<(maps: SharedMaps) => void>>(),
  activeSessionId: null as string | null,
  batchDepth: 0,
  batchedMutations: [] as Array<(maps: SharedMaps) => void>,
};

