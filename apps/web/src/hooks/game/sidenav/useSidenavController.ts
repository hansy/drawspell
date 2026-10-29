import * as React from "react";

import { useGameStore } from "@/store/gameStore";
import type { PeerCounts } from "@/hooks/game/multiplayer-sync/peerCount";
import { performUndo } from "@/hooks/game/undo/useUndo";
import { useUndoStore } from "@/store/gameStore/undo";

export type SyncStatus = "connecting" | "connected";

export type SidenavControllerInput = {
  onCreateToken?: () => void;
  onEndTurn?: () => void;
  onOpenCoinFlipper?: () => void;
  onOpenDiceRoller?: () => void;
  onToggleLog?: () => void;
  isLogOpen?: boolean;
  onOpenShareDialog?: () => void;
  canShareRoom?: boolean;
  onLeaveGame?: () => void;
  onOpenShortcuts?: () => void;
  syncStatus?: SyncStatus;
  peerCounts?: PeerCounts;
  isSpectator?: boolean;
  orientation?: "vertical" | "horizontal";
  onMenuOpenChange?: (open: boolean) => void;
};

export const useSidenavController = ({
  onCreateToken,
  onEndTurn,
  onOpenCoinFlipper,
  onOpenDiceRoller,
  onToggleLog,
  isLogOpen = false,
  onOpenShareDialog,
  canShareRoom = true,
  onLeaveGame,
  onOpenShortcuts,
  syncStatus = "connecting",
  peerCounts = { total: 1, players: 1, spectators: 0 },
  isSpectator = false,
  orientation = "vertical",
  onMenuOpenChange,
}: SidenavControllerInput) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const untapAll = useGameStore((state) => state.untapAll);
  const canUndo = useUndoStore((state) => state.entries.length > 0);
  const isMyTurn = useGameStore(
    (state) => Boolean(state.myPlayerId) && state.activePlayerId === state.myPlayerId,
  );
  const isOut = useGameStore((state) => Boolean(state.players[state.myPlayerId]?.out));
  const canEndTurn = !isSpectator && isMyTurn && Boolean(onEndTurn);

  const handleEndTurn = React.useCallback(() => {
    if (!canEndTurn) return;
    onEndTurn?.();
  }, [canEndTurn, onEndTurn]);

  const handleToggleOut = React.useCallback(() => {
    if (isSpectator) return;
    const state = useGameStore.getState();
    state.setPlayerOut(state.myPlayerId, !isOut);
    setIsMenuOpen(false);
  }, [isOut, isSpectator]);

  const handleUntapAll = React.useCallback(() => {
    if (isSpectator) return;
    untapAll(myPlayerId);
  }, [isSpectator, myPlayerId, untapAll]);

  const openMenu = React.useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = React.useCallback(() => setIsMenuOpen(false), []);

  const handleOpenShortcuts = React.useCallback(() => {
    onOpenShortcuts?.();
    setIsMenuOpen(false);
  }, [onOpenShortcuts]);

  React.useEffect(() => {
    onMenuOpenChange?.(isMenuOpen);
  }, [isMenuOpen, onMenuOpenChange]);

  React.useEffect(() => {
    return () => {
      onMenuOpenChange?.(false);
    };
  }, [onMenuOpenChange]);

  return {
    onCreateToken,
    onOpenCoinFlipper,
    onOpenDiceRoller,
    onToggleLog,
    isLogOpen,
    onOpenShareDialog,
    canShareRoom,
    onLeaveGame,
    syncStatus,
    peerCounts,
    isSpectator,
    orientation,
    isMenuOpen,
    openMenu,
    closeMenu,
    handleUntapAll,
    handleOpenShortcuts,
    canEndTurn,
    isMyTurn,
    handleEndTurn,
    isOut,
    handleToggleOut,
    canUndo,
    handleUndo: performUndo,
  };
};

export type SidenavController = ReturnType<typeof useSidenavController>;
