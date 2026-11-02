import { m } from "@/paraglide/messages.js";
export type GameShortcutId =
  | "ui.closeTopmost"
  | "ui.toggleShortcuts"
  | "ui.toggleLog"
  | "ui.openCoinFlipper"
  | "ui.openDiceRoller"
  | "ui.openTokenModal"
  | "game.untapAll"
  | "game.passTurn"
  | "game.playSelected"
  | "game.drawOne"
  | "game.drawX"
  | "game.discardOne"
  | "game.discardX"
  | "game.exileOne"
  | "game.exileX"
  | "game.shuffleLibrary"
  | "game.zoomIn"
  | "game.zoomOut"
  | "zone.viewGraveyard"
  | "zone.viewExile"
  | "zone.viewLibraryAll"
  | "zone.viewLibraryTop"
  | "game.mulligan"
  | "deck.reset"
  | "deck.unload"
  | "room.leave";

export type GameShortcutBinding = {
  key: string;
  shift?: boolean;
};

export type GameShortcutDefinition = {
  id: GameShortcutId;
  binding: GameShortcutBinding;
  title: string;
  description: string;
  requiresDeckLoaded?: boolean;
};

export const formatShortcutBinding = (binding: GameShortcutBinding) => {
  const key = binding.key === " "
    ? "Space"
    : binding.key.toLowerCase() === "escape"
      ? "Esc"
      : binding.key.toUpperCase();
  return binding.shift ? `Shift + ${key}` : key;
};

export const GAME_SHORTCUTS: GameShortcutDefinition[] = [
  {
    id: "ui.closeTopmost",
    binding: { key: "escape" },
    get title() { return m.close(); },
    get description() { return m.game_shortcuts_closes_the_topmost_open_ui_menus_dialogs_viewers(); },
    requiresDeckLoaded: false,
  },
  {
    id: "ui.toggleShortcuts",
    binding: { key: "/" },
    get title() { return m.game_shortcuts_show_controls(); },
    get description() { return m.game_shortcuts_toggles_the_controls_drawer(); },
    requiresDeckLoaded: false,
  },
  {
    id: "ui.toggleLog",
    binding: { key: "l" },
    get title() { return m.game_shortcuts_toggle_log(); },
    get description() { return m.game_shortcuts_opens_closes_the_game_log_drawer(); },
    requiresDeckLoaded: false,
  },
  {
    id: "ui.openCoinFlipper",
    binding: { key: "c" },
    get title() { return m.coin_flip_dialog_flip_coin(); },
    get description() { return m.game_shortcuts_opens_the_coin_flipper_dialog(); },
    requiresDeckLoaded: false,
  },
  {
    id: "ui.openDiceRoller",
    binding: { key: "r" },
    get title() { return m.dice_roll_dialog_roll_dice(); },
    get description() { return m.game_shortcuts_opens_the_dice_roller_dialog(); },
    requiresDeckLoaded: false,
  },
  {
    id: "ui.openTokenModal",
    binding: { key: "t" },
    get title() { return m.sidenav_view_create_token(); },
    get description() { return m.game_shortcuts_opens_the_token_creation_modal(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.untapAll",
    binding: { key: "u" },
    get title() { return m.sidenav_view_untap_all(); },
    get description() { return m.game_shortcuts_untaps_all_permanents_you_control(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.passTurn",
    binding: { key: " ", shift: true },
    get title() { return m.game_shortcuts_pass_turn(); },
    get description() { return m.game_shortcuts_ends_your_turn_and_passes_to_the_next_eligible_player(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.playSelected",
    binding: { key: "enter" },
    get title() { return m.game_shortcuts_play_selected(); },
    get description() { return m.game_shortcuts_puts_the_selected_cards_from_your_hand_onto_the_battlefield_face(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.drawOne",
    binding: { key: "d" },
    get title() { return m.zone_view_actions_draw_1(); },
    get description() { return m.game_shortcuts_draws_one_card(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.drawX",
    binding: { key: "d", shift: true },
    get title() { return m.game_shortcuts_draw_x(); },
    get description() { return m.game_shortcuts_prompts_for_a_number_default_1_and_draws_that_many_cards(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.discardOne",
    binding: { key: "i" },
    get title() { return m.zone_view_actions_mill_1(); },
    get description() { return m.game_shortcuts_puts_the_top_card_of_your_library_into_your_graveyard(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.discardX",
    binding: { key: "i", shift: true },
    get title() { return m.game_shortcuts_mill_x(); },
    get description() { return m.game_shortcuts_prompts_for_a_number_default_1_and_mills_that_many_cards_from_you(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.exileOne",
    binding: { key: "x" },
    get title() { return m.zone_view_actions_exile_1(); },
    get description() { return m.game_shortcuts_exiles_the_top_card_of_your_library_face_up(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.exileX",
    binding: { key: "x", shift: true },
    get title() { return m.game_shortcuts_exile_top_x(); },
    get description() { return m.game_shortcuts_prompts_for_a_number_and_exiles_that_many_cards_from_the_top_of_y(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.shuffleLibrary",
    binding: { key: "s", shift: true },
    get title() { return m.zone_view_actions_shuffle(); },
    get description() { return m.game_shortcuts_shuffles_your_library(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.zoomIn",
    binding: { key: "+", shift: true },
    get title() { return m.game_shortcuts_zoom_in(); },
    get description() { return m.game_shortcuts_zooms_in_on_the_battlefield(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.zoomOut",
    binding: { key: "-", shift: true },
    get title() { return m.game_shortcuts_zoom_out(); },
    get description() { return m.game_shortcuts_zooms_out_from_the_battlefield(); },
    requiresDeckLoaded: true,
  },
  {
    id: "zone.viewGraveyard",
    binding: { key: "g" },
    get title() { return m.game_shortcuts_view_graveyard(); },
    get description() { return m.game_shortcuts_opens_your_graveyard_viewer(); },
    requiresDeckLoaded: true,
  },
  {
    id: "zone.viewExile",
    binding: { key: "e" },
    get title() { return m.game_shortcuts_view_exile(); },
    get description() { return m.game_shortcuts_opens_your_exile_viewer(); },
    requiresDeckLoaded: true,
  },
  {
    id: "zone.viewLibraryAll",
    binding: { key: "v", shift: true },
    get title() { return m.game_shortcuts_view_library(); },
    get description() { return m.game_shortcuts_opens_your_library_viewer(); },
    requiresDeckLoaded: true,
  },
  {
    id: "zone.viewLibraryTop",
    binding: { key: "v" },
    get title() { return m.game_shortcuts_view_top_x(); },
    get description() { return m.game_shortcuts_prompts_for_a_number_default_1_and_opens_the_top_x_cards_of_your(); },
    requiresDeckLoaded: true,
  },
  {
    id: "game.mulligan",
    binding: { key: "m" },
    get title() { return m.model_mulligan(); },
    get description() { return m.game_shortcuts_prompts_for_a_hand_size_default_7_then_resets_the_deck_and_draws(); },
    requiresDeckLoaded: true,
  },
  {
    id: "deck.reset",
    binding: { key: "r", shift: true },
    get title() { return m.game_shortcuts_reset_deck(); },
    get description() { return m.game_shortcuts_resets_your_deck_state_confirm_required(); },
    requiresDeckLoaded: true,
  },
  {
    id: "deck.unload",
    binding: { key: "u", shift: true },
    get title() { return m.game_shortcuts_unload_deck(); },
    get description() { return m.game_shortcuts_unloads_your_deck_from_the_game_confirm_required(); },
    requiresDeckLoaded: true,
  },
  {
    id: "room.leave",
    binding: { key: "q", shift: true },
    get title() { return m.resume_card_leave_room(); },
    get description() { return m.game_shortcuts_leaves_the_room_confirm_required(); },
    requiresDeckLoaded: false,
  },
];

export const getShortcutLabel = (id: GameShortcutId): string | undefined => {
  const shortcut = GAME_SHORTCUTS.find((s) => s.id === id);
  return shortcut ? formatShortcutBinding(shortcut.binding) : undefined;
};
