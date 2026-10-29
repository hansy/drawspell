import React from "react";
import "mana-font/css/mana.css";
import {
  Coins,
  Dice5,
  ChevronRight,
  ChevronUp,
  Dices,
  Forward,
  Keyboard,
  Smartphone,
  Loader2,
  Mail,
  LogOut,
  Plus,
  ScrollText,
  Share2,
  Undo2,
  Wifi,
} from "lucide-react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";

import drawspellLogo from "@/assets/drawspell-logo.png";
import { Tooltip } from "@/components/ui/tooltip";
import { TurnMenu } from "@/components/game/turn/TurnMenu";
import { cn } from "@/lib/utils";

import type { SidenavController } from "@/hooks/game/sidenav/useSidenavController";

const TAP_LABEL_MS = 500;

interface NavIconProps {
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  hideTooltip?: boolean;
  // Tighter padding so the phone toolbar fits on a 375px screen.
  compact?: boolean;
}

const NavIcon: React.FC<NavIconProps> = ({
  icon,
  label,
  tooltip,
  onClick,
  className,
  disabled = false,
  hideTooltip = false,
  compact = false,
}) => {
  const [showTapLabel, setShowTapLabel] = React.useState(false);
  const tapLabelTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearTapLabelTimeout = React.useCallback(() => {
    if (tapLabelTimeoutRef.current) {
      clearTimeout(tapLabelTimeoutRef.current);
      tapLabelTimeoutRef.current = null;
    }
  }, []);
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || event.pointerType !== "touch") return;
      clearTapLabelTimeout();
      setShowTapLabel(true);
      tapLabelTimeoutRef.current = setTimeout(() => {
        setShowTapLabel(false);
        tapLabelTimeoutRef.current = null;
      }, TAP_LABEL_MS);
    },
    [clearTapLabelTimeout, disabled],
  );
  React.useEffect(
    () => () => {
      clearTapLabelTimeout();
    },
    [clearTapLabelTimeout],
  );

  const button = (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        onPointerDown={handlePointerDown}
        disabled={disabled}
        className={cn(
          "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 active:bg-zinc-800/50 active:scale-95 rounded-lg transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400 disabled:active:bg-transparent disabled:active:text-zinc-400 disabled:active:scale-100",
          compact ? "p-2.5" : "p-3",
          className,
        )}
      >
        {icon}
      </button>
      {showTapLabel && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute z-[80] whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-100 shadow-xl animate-in fade-in duration-150",
            hideTooltip
              ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
              : "left-full top-1/2 ml-2 -translate-y-1/2",
          )}
        >
          {tooltip ?? label}
        </span>
      )}
    </span>
  );

  if (hideTooltip) return button;

  return (
    <Tooltip content={tooltip ?? label} placement="right">
      {button}
    </Tooltip>
  );
};

// Click ends your turn. The caret, a right-click or a long press opens the turn
// menu (choose who's next, sit out); when it isn't your turn a click opens it too.
const EndTurnButton: React.FC<{
  canEndTurn: boolean;
  isMyTurn: boolean;
  onEndTurn: () => void;
  onPassTurnTo?: (playerId: string) => void;
  isHorizontal: boolean;
}> = ({ canEndTurn, isMyTurn, onEndTurn, onPassTurnTo, isHorizontal }) => {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<HTMLSpanElement | null>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const Caret = isHorizontal ? ChevronUp : ChevronRight;

  return (
    <span
      ref={setAnchor}
      className="relative inline-flex"
      onContextMenu={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
    >
      <NavIcon
        icon={<Forward size={20} />}
        label="End turn"
        tooltip={isMyTurn ? "End turn (Shift+Space)" : "Turn options"}
        onClick={() => (canEndTurn ? onEndTurn() : setOpen((value) => !value))}
        className={cn(
          "hover:text-amber-300 active:text-amber-300",
          canEndTurn ? "text-amber-300 bg-amber-400/10" : "text-zinc-500",
          open && "bg-zinc-800/50",
        )}
        hideTooltip={isHorizontal || open}
        compact={isHorizontal}
      />
      <button
        type="button"
        aria-label="Turn options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "absolute flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100",
          isHorizontal ? "-top-0.5 right-0" : "-right-1 bottom-0.5",
        )}
      >
        <Caret size={10} />
      </button>
      {open && (
        <TurnMenu
          anchor={anchor}
          placement={isHorizontal ? "top" : "right-start"}
          onClose={close}
          onEndTurn={onEndTurn}
          onPassTurnTo={onPassTurnTo}
        />
      )}
    </span>
  );
};

// Coin flips and dice rolls share one button so the phone toolbar stays short.
const RandomizeButton: React.FC<{
  onOpenCoinFlipper?: () => void;
  onOpenDiceRoller?: () => void;
  disabled: boolean;
  isHorizontal: boolean;
}> = ({ onOpenCoinFlipper, onOpenDiceRoller, disabled, isHorizontal }) => {
  const [open, setOpen] = React.useState(false);
  const { refs, floatingStyles } = useFloating({
    open,
    placement: isHorizontal ? "top" : "right-start",
    strategy: "fixed",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (action?: () => void) => {
    setOpen(false);
    action?.();
  };

  return (
    <span ref={(node) => { rootRef.current = node; refs.setReference(node); }} className="inline-flex">
      <NavIcon
        icon={<Dices size={20} />}
        label="Coin or dice"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "hover:text-yellow-400 active:text-yellow-400",
          open && "text-yellow-400 bg-zinc-800/50",
        )}
        disabled={disabled}
        hideTooltip={isHorizontal || open}
        compact={isHorizontal}
      />
      {open && (
        <div
          ref={(node) => { menuRef.current = node; refs.setFloating(node); }}
          style={floatingStyles}
          role="menu"
          className="z-50 flex w-44 flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onOpenCoinFlipper)}
            className="flex items-center gap-3 rounded p-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Coins size={16} />
            Flip a coin
            <span className="ml-auto hidden text-[10px] text-zinc-500 lg:inline">C</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onOpenDiceRoller)}
            className="flex items-center gap-3 rounded p-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Dice5 size={16} />
            Roll dice
            <span className="ml-auto hidden text-[10px] text-zinc-500 lg:inline">R</span>
          </button>
        </div>
      )}
    </span>
  );
};

export const SidenavView: React.FC<SidenavController> = ({
  onCreateToken,
  onOpenCoinFlipper,
  onOpenDiceRoller,
  onToggleLog,
  onOpenShareDialog,
  canShareRoom,
  onLeaveGame,
  syncStatus,
  peerCounts,
  isLogOpen,
  isMenuOpen,
  openMenu,
  closeMenu,
  handleUntapAll,
  handleOpenShortcuts,
  canEndTurn,
  isMyTurn,
  handleEndTurn,
  onPassTurnTo,
  canUndo,
  handleUndo,
  isSpectator,
  orientation,
}) => {
  const isHorizontal = orientation === "horizontal";
  const closeMenuTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearCloseMenuTimeout = React.useCallback(() => {
    if (closeMenuTimeoutRef.current) {
      clearTimeout(closeMenuTimeoutRef.current);
      closeMenuTimeoutRef.current = null;
    }
  }, []);
  const scheduleCloseMenu = React.useCallback(() => {
    clearCloseMenuTimeout();
    closeMenuTimeoutRef.current = setTimeout(() => {
      closeMenu();
      closeMenuTimeoutRef.current = null;
    }, 120);
  }, [clearCloseMenuTimeout, closeMenu]);
  React.useEffect(
    () => () => {
      clearCloseMenuTimeout();
    },
    [clearCloseMenuTimeout],
  );
  const peerCountLabel = React.useMemo(() => {
    const parts: string[] = [];
    if (peerCounts.players > 0) {
      parts.push(
        `${peerCounts.players} ${peerCounts.players === 1 ? "player" : "players"}`,
      );
    }
    if (peerCounts.spectators > 0) {
      parts.push(
        `${peerCounts.spectators} ${
          peerCounts.spectators === 1 ? "spectator" : "spectators"
        }`,
      );
    }
    if (parts.length === 0) {
      return "0 players";
    }
    return parts.join(", ");
  }, [peerCounts.players, peerCounts.spectators]);
  const shareDisabled = !canShareRoom;
  const shareTooltip = canShareRoom
    ? "Share room"
    : syncStatus !== "connected"
      ? "Connecting to room"
      : "Share links are only available to players";
  const { refs: menuRefs, floatingStyles: menuFloatingStyles } = useFloating({
    open: isMenuOpen,
    onOpenChange: (next) => {
      if (!next) closeMenu();
    },
    placement: isHorizontal ? "top-end" : "right-end",
    strategy: "fixed",
    middleware: [
      offset(8),
      flip({ padding: 8, fallbackAxisSideDirection: "start" }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const handleMenuToggle = React.useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
      return;
    }
    openMenu();
  }, [closeMenu, isMenuOpen, openMenu]);

  const menu = (
    <div
      className={cn(
        "items-center",
        isHorizontal ? "flex flex-row-reverse gap-1" : "flex flex-col gap-2",
      )}
    >
      {!isSpectator && (
        <NavIcon
          icon={<Share2 size={20} />}
          label="Share room"
          tooltip={shareTooltip}
          onClick={onOpenShareDialog}
          className="hover:text-indigo-400 active:text-indigo-400"
          disabled={shareDisabled}
          hideTooltip={isHorizontal}
              compact={isHorizontal}
        />
      )}

      <div
        className="relative"
        onMouseEnter={
          isHorizontal
            ? undefined
            : () => {
                clearCloseMenuTimeout();
                openMenu();
              }
        }
        onMouseLeave={isHorizontal ? undefined : scheduleCloseMenu}
      >
        <button
          type="button"
          aria-label="Open menu"
          title={syncStatus === "connected" ? "Connected" : "Connecting"}
          aria-expanded={isMenuOpen}
          onClick={handleMenuToggle}
          ref={menuRefs.setReference}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 active:bg-zinc-800/50 touch-manipulation"
        >
          <img
            src={drawspellLogo}
            alt=""
            aria-hidden="true"
            className="w-6 h-6"
          />
          <span
            aria-hidden="true"
            data-connection-dot={syncStatus === "connected" ? "connected" : "connecting"}
            className={cn(
              "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950",
              syncStatus === "connected"
                ? "bg-emerald-400"
                : "bg-amber-400 motion-safe:animate-pulse",
            )}
          />
        </button>

        {isMenuOpen && (
          <div
            ref={menuRefs.setFloating}
            style={menuFloatingStyles}
            className="z-50 w-[min(16rem,calc(100dvw-1rem))] max-h-[min(22rem,calc(100dvh-1rem))] overflow-y-auto"
            onMouseEnter={isHorizontal ? undefined : clearCloseMenuTimeout}
            onMouseLeave={isHorizontal ? undefined : scheduleCloseMenu}
          >
            <div
              className={cn(
                "bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 flex flex-col gap-1 animate-in fade-in",
                isHorizontal
                  ? "slide-in-from-bottom-2"
                  : "slide-in-from-left-2",
              )}
            >
              {!isSpectator && (
                <>
                  <div className="flex items-center gap-3 p-2 text-sm">
                    {syncStatus === "connected" ? (
                      <>
                        <Wifi size={16} className="text-emerald-400" />
                        <span className="text-zinc-300">
                          Connected
                          <span className="text-zinc-500 ml-1">
                            ({peerCountLabel})
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Loader2
                          size={16}
                          className="text-amber-400 motion-safe:animate-spin"
                        />
                        <span className="text-amber-400">Connecting</span>
                      </>
                    )}
                  </div>

                  <div className="border-t border-zinc-800 my-1" />

                  <button
                    onClick={() => {
                      handleUndo();
                      closeMenu();
                    }}
                    disabled={!canUndo}
                    className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800 text-left text-sm text-zinc-300 hover:text-zinc-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Undo2 size={16} />
                    Undo last action
                    <span className="ml-auto hidden text-[10px] text-zinc-500 lg:inline">
                      Ctrl/⌘ Z
                    </span>
                  </button>

                  <button
                    onClick={handleOpenShortcuts}
                    className="hidden lg:flex items-center gap-3 p-2 rounded hover:bg-zinc-800 text-left text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                  >
                    <Keyboard size={16} />
                    Controls
                  </button>
                  <button
                    onClick={handleOpenShortcuts}
                    className="flex lg:hidden items-center gap-3 p-2 rounded hover:bg-zinc-800 text-left text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                  >
                    <Smartphone size={16} />
                    Controls
                  </button>
                </>
              )}

              <a
                href="mailto:feedback@drawspell.space"
                className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800 text-left text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                <Mail size={16} />
                Send Feedback!
              </a>

              <button
                onClick={onLeaveGame}
                className="flex items-center gap-3 p-2 rounded hover:bg-red-900/20 text-left text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {isSpectator ? "Leave Game" : <LogOut size={16} />}
                {isSpectator ? null : "Leave Game"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "bg-zinc-950 z-[60]",
          isHorizontal
            ? "h-[var(--mobile-sidenav-h,3.75rem)] w-full min-w-0 border-t border-zinc-800 px-1 flex flex-row-reverse items-center justify-between"
            : "sticky top-0 h-[100dvh] w-12 lg:w-[var(--sidenav-w)] border-r border-zinc-800 py-4 flex flex-col items-center",
        )}
      >
        {isSpectator ? (
          <>
            <NavIcon
              icon={<ScrollText size={20} />}
              label="Game Log"
              onClick={onToggleLog}
              className={cn(
                "hover:text-amber-400 active:text-amber-400",
                isLogOpen && "text-amber-400 bg-amber-500/10",
              )}
              hideTooltip={isHorizontal}
              compact={isHorizontal}
            />

            <div className="flex-1" />

            {menu}
          </>
        ) : (
          <>
            <EndTurnButton
              canEndTurn={canEndTurn}
              isMyTurn={isMyTurn}
              onEndTurn={handleEndTurn}
              onPassTurnTo={onPassTurnTo}
              isHorizontal={isHorizontal}
            />

            <NavIcon
              icon={
                <i
                  aria-hidden="true"
                  className="ms ms-untap block h-5 w-5 text-[20px] leading-5"
                />
              }
              label="Untap All"
              onClick={handleUntapAll}
              className="hover:text-blue-400 active:text-blue-400"
              disabled={isSpectator}
              hideTooltip={isHorizontal}
              compact={isHorizontal}
            />

            <NavIcon
              icon={<Plus size={20} />}
              label="Create Token"
              onClick={onCreateToken}
              className="hover:text-emerald-400 active:text-emerald-400"
              disabled={isSpectator}
              hideTooltip={isHorizontal}
              compact={isHorizontal}
            />

            <RandomizeButton
              onOpenCoinFlipper={onOpenCoinFlipper}
              onOpenDiceRoller={onOpenDiceRoller}
              disabled={isSpectator}
              isHorizontal={isHorizontal}
            />

            <NavIcon
              icon={<ScrollText size={20} />}
              label="Game Log"
              onClick={onToggleLog}
              className={cn(
                "hover:text-amber-400 active:text-amber-400",
                isLogOpen && "text-amber-400 bg-amber-500/10",
              )}
              hideTooltip={isHorizontal}
              compact={isHorizontal}
            />

            <div className="flex-1" />

            {menu}
          </>
        )}
      </div>

      {isMenuOpen && <div className="fixed inset-0 z-40" onClick={closeMenu} />}
    </>
  );
};
