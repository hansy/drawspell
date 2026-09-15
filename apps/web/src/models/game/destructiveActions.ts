import type { ConfirmationRequest } from "@/hooks/shared/useConfirmationDialog";

type ConfirmationCopy = Pick<
  ConfirmationRequest,
  "title" | "message" | "confirmLabel"
>;

export const DESTRUCTIVE_ACTION_CONFIRMATIONS = {
  resetDeck: {
    title: "Reset this deck?",
    message:
      "Cards will return to their starting zones, tokens will be removed, card state will be cleared, and the Library will be shuffled.",
    confirmLabel: "Reset",
  },
  unloadDeck: {
    title: "Unload this deck?",
    message: "All of its cards and tokens will be removed from the Room.",
    confirmLabel: "Unload",
  },
  leaveRoom: {
    title: "Leave this Room?",
    message: "Your player and cards will be removed from the Room.",
    confirmLabel: "Leave Room",
  },
  shuffleLibrary: {
    title: "Shuffle this Library?",
    message: "Its current card order will be lost.",
    confirmLabel: "Shuffle",
  },
} satisfies Record<string, ConfirmationCopy>;

export const removeTokensConfirmation = (count: number): ConfirmationCopy => ({
  title: `Remove these ${count} tokens?`,
  message: "This cannot be undone.",
  confirmLabel: "Remove tokens",
});
