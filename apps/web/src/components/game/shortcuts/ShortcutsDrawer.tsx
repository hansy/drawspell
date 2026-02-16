import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GAME_SHORTCUTS, formatShortcutBinding } from '@/models/game/shortcuts/gameShortcuts';

interface ShortcutsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const TOUCH_CONTROLS = [
    {
        id: "touch.moveCard",
        title: "Move Card",
        description: "Drag a card to reposition it.",
        gesture: "Tap + drag",
    },
    {
        id: "touch.tapUntapCard",
        title: "Tap / Untap Card",
        description: "Toggle a battlefield card's tapped state.",
        gesture: "Double tap",
    },
    {
        id: "touch.openGraveyardOrExile",
        title: "Open Graveyard / Exile",
        description: "View cards in graveyard or exile.",
        gesture: "Tap",
    },
    {
        id: "touch.drawFromLibrary",
        title: "Draw From Library",
        description: "Draw one card from your library.",
        gesture: "Double tap",
    },
    {
        id: "touch.openContextMenu",
        title: "Open Context Menu",
        description: "Use on cards, zones, life, and battlefield.",
        gesture: "Long press",
    },
    {
        id: "touch.zoomBattlefield",
        title: "Zoom Battlefield",
        description: "Adjust battlefield zoom level.",
        gesture: "Pinch",
    },
    {
        id: "touch.switchFocusedSeat",
        title: "Switch Focused Seat",
        description: "Cycle the active seat while spectating/rotating views.",
        gesture: "Two-finger swipe",
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
                    <h2 className="font-bold text-zinc-100 uppercase tracking-wider text-sm items-center gap-2 hidden lg:flex">
                        Keyboard Shortcuts
                    </h2>
                    <h2 className="font-bold text-zinc-100 uppercase tracking-wider text-sm flex items-center gap-2 lg:hidden">
                        Touch Controls
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <div className="space-y-1 hidden lg:block">
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

                    <div className="space-y-1 lg:hidden">
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
