// Flag to prevent feedback loops: Yjs -> Zustand -> Yjs
let applyingRemoteUpdate = false;

export function isApplyingRemoteUpdate(): boolean {
  return applyingRemoteUpdate;
}

export function withApplyingRemoteUpdate<T>(fn: () => T): T {
  applyingRemoteUpdate = true;
  try {
    return fn();
  } finally {
    applyingRemoteUpdate = false;
  }
}

