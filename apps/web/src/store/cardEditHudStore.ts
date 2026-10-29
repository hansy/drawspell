import { create } from "zustand";

// Which battlefield card shows its on-card edit controls (counters, P/T).
// Hover opens it. Leaving the card, or brushing past a neighbouring card on the
// way to the controls, only takes effect after a grace period, so the pointer
// can always travel from the card to its controls.
const CLOSE_DELAY_MS = 300;
const SWITCH_DELAY_MS = 250;

let closeTimer: ReturnType<typeof setTimeout> | null = null;
let switchTimer: ReturnType<typeof setTimeout> | null = null;

const clearTimers = () => {
  if (closeTimer) clearTimeout(closeTimer);
  if (switchTimer) clearTimeout(switchTimer);
  closeTimer = null;
  switchTimer = null;
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
    const current = get();
    if (options?.pinned) {
      clearTimers();
      set({ cardId, anchor, pinned: true });
      return;
    }
    if (current.pinned && current.cardId !== cardId) return;
    if (current.cardId && current.cardId !== cardId) {
      // Another card's controls are showing: wait, in case the pointer is only crossing.
      if (switchTimer) clearTimeout(switchTimer);
      switchTimer = setTimeout(() => {
        switchTimer = null;
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = null;
        set({ cardId, anchor, pinned: false });
      }, SWITCH_DELAY_MS);
      return;
    }
    clearTimers();
    set({ cardId, anchor, pinned: false });
  },
  requestClose: (cardId) => {
    if (switchTimer && get().cardId !== cardId) {
      // Left a card we were about to switch to before the switch happened.
      clearTimeout(switchTimer);
      switchTimer = null;
    }
    const current = get();
    if (current.cardId !== cardId || current.pinned) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (get().cardId === cardId && !get().pinned) {
        set({ cardId: null, anchor: null });
      }
    }, CLOSE_DELAY_MS);
  },
  // The pointer reached the controls: keep them and drop any pending switch or close.
  cancelClose: clearTimers,
  close: () => {
    clearTimers();
    set({ cardId: null, anchor: null, pinned: false });
  },
}));
