import { create } from "zustand";

// Which battlefield card shows its on-card edit controls (counters, P/T).
// Hover opens it; leaving the card or the controls closes it after a short grace
// period so the pointer can travel from one to the other.
const CLOSE_DELAY_MS = 160;

let closeTimer: ReturnType<typeof setTimeout> | null = null;

const clearCloseTimer = () => {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
};

export const useCardEditHudStore = create<{
  cardId: string | null;
  anchor: HTMLElement | null;
  // Pinned stays open until dismissed (used when opened from a menu or by touch).
  pinned: boolean;
  open: (cardId: string, anchor: HTMLElement, options?: { pinned?: boolean }) => void;
  requestClose: (cardId: string) => void;
  cancelClose: () => void;
  close: () => void;
}>((set, get) => ({
  cardId: null,
  anchor: null,
  pinned: false,
  open: (cardId, anchor, options) => {
    clearCloseTimer();
    const current = get();
    if (current.pinned && current.cardId !== cardId && !options?.pinned) return;
    set({ cardId, anchor, pinned: Boolean(options?.pinned) });
  },
  requestClose: (cardId) => {
    const current = get();
    if (current.cardId !== cardId || current.pinned) return;
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (get().cardId === cardId && !get().pinned) {
        set({ cardId: null, anchor: null });
      }
    }, CLOSE_DELAY_MS);
  },
  cancelClose: clearCloseTimer,
  close: () => {
    clearCloseTimer();
    set({ cardId: null, anchor: null, pinned: false });
  },
}));
