import { m } from "@/paraglide/messages.js";
import type { ConfirmationRequest } from "@/hooks/shared/useConfirmationDialog";

type ConfirmationCopy = Pick<
  ConfirmationRequest,
  "title" | "message" | "confirmLabel"
>;

export const DESTRUCTIVE_ACTION_CONFIRMATIONS = {
  resetDeck: {
    get title() { return m.destructive_actions_reset_this_deck(); },
    get message() { return m.destructive_actions_cards_will_return_to_their_starting_zones_tokens_will_be_removed(); },
    get confirmLabel() { return m.zone_view_actions_reset(); },
  },
  unloadDeck: {
    get title() { return m.destructive_actions_unload_this_deck(); },
    get message() { return m.destructive_actions_all_of_its_cards_and_tokens_will_be_removed_from_the_room(); },
    get confirmLabel() { return m.zone_view_actions_unload(); },
  },
  leaveRoom: {
    get title() { return m.destructive_actions_leave_this_room(); },
    get message() { return m.destructive_actions_your_player_and_cards_will_be_removed_from_the_room(); },
    get confirmLabel() { return m.resume_card_leave_room(); },
  },
  shuffleLibrary: {
    get title() { return m.destructive_actions_shuffle_this_library(); },
    get message() { return m.destructive_actions_its_current_card_order_will_be_lost(); },
    get confirmLabel() { return m.zone_view_actions_shuffle(); },
  },
} satisfies Record<string, ConfirmationCopy>;

export const removeTokensConfirmation = (count: number): ConfirmationCopy => ({
  title: m.destructive_actions_remove_these_tokens({ count: count }),
  message: m.destructive_actions_this_cannot_be_undone(),
  confirmLabel: m.destructive_actions_remove_tokens(),
});
