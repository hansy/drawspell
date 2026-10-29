import { create } from "zustand";

// Which part of which battlefield card shows its edit controls: its counters,
// its power/toughness, or (pinned from the card menu on touch) both.
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

export type CardEditSection = "counters" | "pt" | "all";

export const useCardEditHudStore = create<{
  cardId: string | null;
  section: CardEditSection;
  anchor: HTMLElement | null;
  // Pinned stays open until dismissed (used when opened from a menu or by touch).
  pinned: boolean;
  open: (
    cardId: string,
    anchor: HTMLElement,
    options?: { pinned?: boolean; section?: CardEditSection },
  ) => void;
  requestClose: (cardId: string) => void;
  cancelClose: () => void;
  close: () => void;
}>((set, get) => ({
  cardId: null,
  section: "all",
  anchor: null,
  pinned: false,
  open: (cardId, anchor, options) => {
    const current = get();
    const section = options?.section ?? "all";
    if (options?.pinned) {
      clearTimers();
      set({ cardId, anchor, section, pinned: true });
      return;
    }
    if (current.pinned) return;
    if (current.cardId === cardId && current.section === section) {
      clearTimers();
      return;
    }
    if (current.cardId && current.cardId !== cardId) {
      // Another card's controls are showing: wait, in case the pointer is only crossing.
      if (switchTimer) clearTimeout(switchTimer);
      switchTimer = setTimeout(() => {
        switchTimer = null;
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = null;
        set({ cardId, anchor, section, pinned: false });
      }, SWITCH_DELAY_MS);
      return;
    }
    clearTimers();
    set({ cardId, anchor, section, pinned: false });
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
