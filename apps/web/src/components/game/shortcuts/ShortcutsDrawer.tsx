import { m } from "@/paraglide/messages.js";
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GAME_SHORTCUTS, formatShortcutBinding } from '@/models/game/shortcuts/gameShortcuts';

interface ShortcutsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const MOUSE_CONTROLS = [
    {
        id: "mouse.activateCard",
        get title() { return m.shortcuts_drawer_activate_card(); },
        get description() { return m.shortcuts_drawer_tap_or_untap_a_battlefield_card_select_or_deselect_a_card_in_hand(); },
        get gesture() { return m.gesture_click(); },
    },
    {
        id: "mouse.previewCard",
        get title() { return m.shortcuts_drawer_preview_card(); },
        get description() { return m.shortcuts_drawer_open_and_lock_a_card_preview(); },
        get gesture() { return m.gesture_double_click(); },
    },
    {
        id: "mouse.moveCard",
        get title() { return m.shortcuts_drawer_move_card(); },
        get description() { return m.shortcuts_drawer_drag_a_card_to_reposition_or_move_it_a_library_s_top_card_stays_h(); },
        get gesture() { return m.gesture_drag(); },
    },
    {
        id: "mouse.openContextMenu",
        get title() { return m.shortcuts_drawer_open_context_menu(); },
        get description() { return m.shortcuts_drawer_use_on_cards_zones_and_life(); },
        get gesture() { return m.gesture_right_click(); },
    },
    {
        id: "mouse.panBattlefield",
        get title() { return m.shortcuts_drawer_pan_battlefield(); },
        get description() { return m.shortcuts_drawer_hold_the_right_mouse_button_on_empty_battlefield_space_and_drag_s(); },
        get gesture() { return m.gesture_right_drag(); },
    },
    {
        id: "mouse.adjustMana",
        get title() { return m.shortcuts_drawer_adjust_floating_mana(); },
        get description() { return m.shortcuts_drawer_left_click_a_mana_orb_to_add_one_right_click_removes_one_hover_fo(); },
        get gesture() { return m.gesture_click(); },
    },
] as const;

const TOUCH_CONTROLS = [
    {
        id: "touch.moveCard",
        get title() { return m.shortcuts_drawer_move_card(); },
        get description() { return m.shortcuts_drawer_drag_a_card_to_reposition_or_move_it_a_library_s_top_card_stays_h(); },
        get gesture() { return m.gesture_tap_drag(); },
    },
    {
        id: "touch.tapUntapCard",
        get title() { return m.shortcuts_drawer_tap_untap_battlefield_card(); },
        get description() { return m.shortcuts_drawer_toggle_a_battlefield_card_s_tapped_state(); },
        get gesture() { return m.gesture_tap(); },
    },
    {
        id: "touch.selectCards",
        get title() { return m.shortcuts_drawer_select_cards(); },
        get description() { return m.shortcuts_drawer_select_or_deselect_cards_in_hand_or_a_zone_viewer_for_group_actio(); },
        get gesture() { return m.gesture_tap(); },
    },
    {
        id: "touch.previewCard",
        get title() { return m.shortcuts_drawer_preview_card(); },
        get description() { return m.shortcuts_drawer_open_and_lock_a_card_preview(); },
        get gesture() { return m.gesture_double_tap(); },
    },
    {
        id: "touch.openGraveyardOrExile",
        get title() { return m.shortcuts_drawer_open_graveyard_exile(); },
        get description() { return m.shortcuts_drawer_view_cards_in_graveyard_or_exile(); },
        get gesture() { return m.gesture_tap(); },
    },
    {
        id: "touch.drawFromLibrary",
        get title() { return m.shortcuts_drawer_draw_from_library(); },
        get description() { return m.shortcuts_drawer_draw_one_card_from_your_library(); },
        get gesture() { return m.gesture_double_tap(); },
    },
    {
        id: "touch.openContextMenu",
        get title() { return m.shortcuts_drawer_open_context_menu(); },
        get description() { return m.shortcuts_drawer_use_on_cards_zones_life_and_battlefield(); },
        get gesture() { return m.gesture_long_press(); },
    },
    {
        id: "touch.adjustMana",
        get title() { return m.shortcuts_drawer_adjust_floating_mana(); },
        get description() { return m.shortcuts_drawer_tap_an_orb_then_use_tap_elsewhere_to_close_clear_removes_all_floa(); },
        get gesture() { return m.gesture_tap_orb(); },
    },
    {
        id: "touch.zoomBattlefield",
        get title() { return m.shortcuts_drawer_zoom_battlefield(); },
        get description() { return m.shortcuts_drawer_adjust_battlefield_zoom_level(); },
        get gesture() { return m.gesture_pinch(); },
    },
    {
        id: "touch.switchFocusedSeat",
        get title() { return m.shortcuts_drawer_switch_focused_seat(); },
        get description() { return m.shortcuts_drawer_cycle_the_active_seat_while_spectating_rotating_views(); },
        get gesture() { return m.gesture_two_finger_swipe(); },
    },
] as const;

export const ShortcutsDrawer: React.FC<ShortcutsDrawerProps> = ({ isOpen, onClose }) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/10 z-[60] transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    "fixed z-[61] flex flex-col bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out left-2 right-2 top-2 bottom-[calc(var(--mobile-sidenav-h,3.75rem)+0.5rem)] rounded-xl lg:left-[3.5rem] lg:right-auto lg:top-4 lg:bottom-4 lg:w-[min(24rem,calc(100dvw-4.5rem))] lg:rounded-r-xl lg:rounded-l-md",
                    isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-[120%] pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/50 rounded-tl-md rounded-tr-xl">
                    <h2 className="font-bold text-zinc-100 uppercase tracking-wider text-sm flex items-center gap-2">
                        {m.shortcuts_drawer_controls()}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <div className="hidden desktop:flex desktop:flex-col desktop:gap-4">
                        <section aria-labelledby="mouse-controls-heading">
                            <h3
                                id="mouse-controls-heading"
                                className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                            >
                                {m.shortcuts_drawer_mouse_controls()}</h3>
                            <div className="space-y-1">
                                {MOUSE_CONTROLS.map((control) => (
                                    <div
                                        key={control.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-zinc-800 hover:bg-zinc-900/40"
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-sm font-medium text-zinc-200">
                                                {control.title}
                                            </div>
                                            <div className="text-xs leading-tight text-zinc-500">
                                                {control.description}
                                            </div>
                                        </div>

                                        <div className="shrink-0 whitespace-nowrap rounded border-b-4 border-zinc-400 bg-zinc-200 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-zinc-900 shadow-sm">
                                            {control.gesture}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section aria-labelledby="keyboard-shortcuts-heading">
                            <h3
                                id="keyboard-shortcuts-heading"
                                className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                            >
                                {m.shortcuts_drawer_keyboard_shortcuts()}</h3>
                            <div className="space-y-1">
                                {GAME_SHORTCUTS.map((shortcut) => {
                                    const label = formatShortcutBinding(shortcut.binding);
                                    const keys = label.split(" + ");

                                    return (
                                        <div key={shortcut.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900/40 transition-colors group border border-transparent hover:border-zinc-800">
                                            <div className="flex flex-col gap-0.5 max-w-[65%]">
                                                <div className="text-zinc-200 font-medium text-sm">
                                                    {shortcut.title}
                                                </div>
                                                <div className="text-zinc-500 text-xs leading-tight">
                                                    {shortcut.description}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {keys.map((k, i) => (
                                                    <React.Fragment key={i}>
                                                        <div className="
                                                            px-2 py-1
                                                            min-w-[28px] text-center
                                                            bg-zinc-200 text-zinc-900
                                                            font-bold font-mono text-xs
                                                            rounded
                                                            border-b-4 border-zinc-400
                                                            shadow-sm
                                                            transform active:translate-y-[2px] active:border-b-2
                                                            transition-all
                                                            uppercase
                                                        ">
                                                            {k}
                                                        </div>
                                                        {i < keys.length - 1 && <span className="text-zinc-600 text-[10px]">+</span>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-1 desktop:hidden">
                        {TOUCH_CONTROLS.map((control) => (
                            <div
                                key={control.id}
                                className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900/40 transition-colors group border border-transparent hover:border-zinc-800 gap-3"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <div className="text-zinc-200 font-medium text-sm">
                                        {control.title}
                                    </div>
                                    <div className="text-zinc-500 text-xs leading-tight">
                                        {control.description}
                                    </div>
                                </div>

                                <div className="shrink-0 px-2.5 py-1.5 bg-zinc-200 text-zinc-900 font-semibold font-mono text-[11px] rounded border-b-4 border-zinc-400 shadow-sm whitespace-nowrap">
                                    {control.gesture}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
