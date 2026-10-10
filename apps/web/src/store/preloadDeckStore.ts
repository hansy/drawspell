import { create } from "zustand";
import type { PreloadDeckPayload } from "@/partykit/messages";

type PendingPreload = PreloadDeckPayload & {
  sessionId: string;
  playerId: string;
  started: boolean;
};

type PreloadDeckState = {
  pending: PendingPreload | null;
  receive: (sessionId: string, playerId: string, payload: PreloadDeckPayload) => void;
  start: (assignmentId: string) => boolean;
};

// The Room persists delivery against the existing player identity. Keep the
// private assignment here while the lazy import modal mounts and resolves cards.
export const usePreloadDeckStore = create<PreloadDeckState>((set, get) => ({
  pending: null,
  receive: (sessionId, playerId, payload) => {
    const current = get().pending;
    if (current?.sessionId === sessionId && current.playerId === playerId && current.assignmentId === payload.assignmentId) return;
    set({ pending: { ...payload, sessionId, playerId, started: false } });
  },
  start: (assignmentId) => {
    const current = get().pending;
    if (!current || current.started || current.assignmentId !== assignmentId) return false;
    set({ pending: { ...current, started: true } });
    return true;
  },
}));
