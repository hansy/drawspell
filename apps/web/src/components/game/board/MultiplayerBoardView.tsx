import React from "react";
import { Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  getClientRect,
  pointerWithin,
} from "@dnd-kit/core";

import { ZONE } from "@/constants/zones";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CardView } from "../card/CardView";
import { CardPreviewProvider } from "../card/CardPreviewProvider";
import { shouldRenderFaceDown } from "@/lib/reveal";
import { Seat } from "../seat/Seat";
import { ContextMenu } from "../context-menu/ContextMenu";
import { AddCounterModal } from "../add-counter/AddCounterModal";
import { CoinFlipDialog } from "../coin/CoinFlipDialog";
import { DiceRollDialog } from "../dice/DiceRollDialog";
import { LoadDeckModal } from "../load-deck/LoadDeckModal";
import { LogDrawer } from "../log-drawer/LogDrawer";
import { NumberPromptDialog } from "../prompts/NumberPromptDialog";
import { OpponentLibraryRevealsModal } from "../opponent-library-reveals/OpponentLibraryRevealsModal";
import { ShortcutsDrawer } from "../shortcuts/ShortcutsDrawer";
import { Sidenav } from "../sidenav/Sidenav";
import { TextPromptDialog } from "../prompts/TextPromptDialog";
import { TokenCreationModal } from "../token-creation/TokenCreationModal";
import { ZoneViewerModal } from "../zone-viewer/ZoneViewerModal";
import { EditUsernameDialog } from "@/components/username/EditUsernameDialog";
import { ShareRoomDialog } from "@/components/game/share/ShareRoomDialog";

import type { MultiplayerBoardController } from "@/hooks/game/board/useMultiplayerBoardController";

type MultiplayerBoardViewProps = Omit<
  MultiplayerBoardController,
  "joinBlocked" | "roomOverCapacity"
>;

type SeatSlot = MultiplayerBoardViewProps["slots"][number];
type SeatPosition = SeatSlot["position"];
type OccupiedSeatSlot = SeatSlot & { player: NonNullable<SeatSlot["player"]> };

const MOBILE_SWIPE_MIN_DISTANCE_PX = 56;
const MOBILE_SWIPE_MAX_DURATION_MS = 650;
const PORTRAIT_SEAT_BANNER_MS = 1_400;
const SEAT_SWIPE_BLOCK_SELECTOR =
  "[data-card-id],button,a,input,textarea,select,[role='dialog'],[data-no-seat-swipe='true']";

const SEAT_COORDS: Record<SeatPosition, { x: number; y: number }> = {
  "top-left": { x: 0, y: 0 },
  "top-right": { x: 1, y: 0 },
  "bottom-left": { x: 0, y: 1 },
  "bottom-right": { x: 1, y: 1 },
};
const DEFAULT_SEAT_PRIORITY: SeatPosition[] = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
];

const SEAT_COLOR_CLASS: Record<string, string> = {
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
};
const PORTRAIT_VERTICAL_POSITIONS: SeatPosition[] = ["top-left", "bottom-left"];
const PORTRAIT_SQUARE_POSITIONS: SeatPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const isOccupiedSeat = (slot: SeatSlot): slot is OccupiedSeatSlot =>
  Boolean(slot.player);

const getSeatDisplayName = (
  player: OccupiedSeatSlot["player"],
  myPlayerId: string,
) => {
  if (player.id === myPlayerId) return "You";
  const trimmed = player.name.trim();
  return trimmed.length > 0 ? trimmed : "Player";
};

const getSeatAriaLabel = (
  player: OccupiedSeatSlot["player"],
  myPlayerId: string,
) => {
  if (player.id === myPlayerId) return "Switch to your seat";
  return `Switch to ${getSeatDisplayName(player, myPlayerId)}'s seat`;
};

const resolveSwipeTargetSeat = (
  activeSeat: OccupiedSeatSlot,
  seats: OccupiedSeatSlot[],
  dx: number,
  dy: number,
): OccupiedSeatSlot | null => {
  const current = SEAT_COORDS[activeSeat.position];
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < MOBILE_SWIPE_MIN_DISTANCE_PX && absY < MOBILE_SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  let stepX = absX >= MOBILE_SWIPE_MIN_DISTANCE_PX ? -Math.sign(dx) : 0;
  let stepY = absY >= MOBILE_SWIPE_MIN_DISTANCE_PX ? -Math.sign(dy) : 0;

  if (stepX === 0 && stepY === 0) {
    if (absX >= absY) stepX = -Math.sign(dx);
    else stepY = -Math.sign(dy);
  }
  if (stepX === 0 && stepY === 0) return null;

  const nextTarget = {
    x: Math.max(0, Math.min(1, current.x + stepX)),
    y: Math.max(0, Math.min(1, current.y + stepY)),
  };

  const exactMatch = seats.find((seat) => {
    if (seat.player.id === activeSeat.player.id) return false;
    const coords = SEAT_COORDS[seat.position];
    return coords.x === nextTarget.x && coords.y === nextTarget.y;
  });
  if (exactMatch) return exactMatch;

  const directionalCandidates = seats.filter((seat) => {
    if (seat.player.id === activeSeat.player.id) return false;
    const coords = SEAT_COORDS[seat.position];
    if (stepX !== 0 && (coords.x - current.x) * stepX <= 0) return false;
    if (stepY !== 0 && (coords.y - current.y) * stepY <= 0) return false;
    return true;
  });

  if (directionalCandidates.length === 0) return null;

  return directionalCandidates.sort((a, b) => {
    const aCoords = SEAT_COORDS[a.position];
    const bCoords = SEAT_COORDS[b.position];
    const aDist = Math.hypot(nextTarget.x - aCoords.x, nextTarget.y - aCoords.y);
    const bDist = Math.hypot(nextTarget.x - bCoords.x, nextTarget.y - bCoords.y);
    return aDist - bDist;
  })[0];
};

const usePortraitViewport = () => {
  const getMatches = React.useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return (
      window.matchMedia("(orientation: portrait)").matches &&
      window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  const [matches, setMatches] = React.useState(getMatches);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const orientationMedia = window.matchMedia("(orientation: portrait)");
    const pointerMedia = window.matchMedia("(pointer: coarse)");
    const sync = () => setMatches(orientationMedia.matches && pointerMedia.matches);

    sync();
    orientationMedia.addEventListener?.("change", sync);
    pointerMedia.addEventListener?.("change", sync);

    return () => {
      orientationMedia.removeEventListener?.("change", sync);
      pointerMedia.removeEventListener?.("change", sync);
    };
  }, []);

  return matches;
};

const PortraitSeatIndicator: React.FC<{
  seats: OccupiedSeatSlot[];
  activeSeatPlayerId: string | null;
  myPlayerId: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSelectSeat: (playerId: string) => void;
}> = ({
  seats,
  activeSeatPlayerId,
  myPlayerId,
  isExpanded,
  onToggleExpanded,
  onSelectSeat,
}) => {
  const isVertical = seats.length === 2;
  const positions = isVertical
    ? PORTRAIT_VERTICAL_POSITIONS
    : PORTRAIT_SQUARE_POSITIONS;
  const seatByPosition = new Map(seats.map((slot) => [slot.position, slot]));
  const otherSeats = seats.filter((slot) => slot.player.id !== activeSeatPlayerId);

  if (!isExpanded) {
    return (
      <button
        type="button"
        aria-label="Expand seat picker"
        onClick={onToggleExpanded}
        className={cn(
          "grid rounded-[1.15rem] border border-zinc-700/70 bg-zinc-950/88 p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.32)] backdrop-blur transition-transform duration-150 active:scale-[0.97]",
          isVertical ? "h-12 w-7 grid-cols-1 grid-rows-2 gap-1" : "h-10 w-10 grid-cols-2 grid-rows-2 gap-1",
        )}
        data-testid="portrait-seat-indicator"
        data-layout={isVertical ? "vertical" : "square"}
        data-state="collapsed"
        data-no-seat-swipe="true"
      >
        {positions.map((position) => {
          const slot = seatByPosition.get(position);
          const isActive = slot?.player.id === activeSeatPlayerId;
          const seatColorClass = slot ? SEAT_COLOR_CLASS[slot.color] : undefined;
          const fallbackColorStyle =
            slot && !seatColorClass ? { backgroundColor: slot.color } : undefined;

          return (
            <span
              key={position}
              className={cn(
                "flex items-center justify-center rounded-md border border-zinc-800/80 bg-zinc-900/65",
                !slot && "opacity-30",
              )}
              data-seat-position={slot?.position ?? position}
              data-active={isActive ? "true" : "false"}
            >
              {slot ? (
                <span
                  className={cn(
                    "block rounded-full border",
                    "h-2 w-2",
                    seatColorClass ?? "bg-white",
                    isActive
                      ? "border-white/90 ring-2 ring-white/25"
                      : "border-white/35 opacity-75",
                  )}
                  style={fallbackColorStyle}
                />
              ) : null}
            </span>
          );
        })}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "w-[min(13rem,calc(100vw-2rem))] rounded-[1.2rem] border border-zinc-700/70 bg-zinc-950/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur",
      )}
      data-testid="portrait-seat-indicator"
      data-layout={isVertical ? "vertical" : "square"}
      data-state="expanded"
      data-no-seat-swipe="true"
    >
      <div className="flex flex-col gap-1">
        {otherSeats.map((slot) => {
          const seatColorClass = SEAT_COLOR_CLASS[slot.color];
          const fallbackColorStyle = !seatColorClass
            ? { backgroundColor: slot.color }
            : undefined;
          const seatDisplayName = getSeatDisplayName(slot.player, myPlayerId);

          return (
            <button
              type="button"
              key={`${slot.player.id}-option`}
              aria-label={getSeatAriaLabel(slot.player, myPlayerId)}
              onClick={() => onSelectSeat(slot.player.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-[0.95rem] border border-zinc-700/80 bg-zinc-900/88 px-2.5 py-2 text-left transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-sky-300/50 active:scale-[0.98]",
              )}
              data-testid="portrait-seat-option"
              data-seat-position={slot.position}
              data-active="false"
            >
              <span
                className={cn(
                  "block h-3.5 w-3.5 shrink-0 rounded-full border",
                  seatColorClass ?? "bg-white",
                  "border-white/30",
                )}
                style={fallbackColorStyle}
                data-testid="portrait-seat-option-color"
              />
              <span className="min-w-0 truncate text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-zinc-100">
                {seatDisplayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const MultiplayerBoardView: React.FC<MultiplayerBoardViewProps> = ({
  zones,
  cards,
  players,
  libraryRevealsToAll,
  battlefieldViewScale,
  battlefieldGridSizing,
  playerColors,
  gridClass,
  scale,
  myPlayerId,
  viewerRole,
  slots,
  activeModal,
  setActiveModal,
  overCardScale,
  activeCardId,
  activeCardScale,
  isGroupDragging,
  showGroupDragOverlay,
  groupDragCardIds,
  sensors,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  syncStatus,
  peerCounts,
  isHost,
  roomLockedByHost,
  roomIsFull,
  onToggleRoomLock,
  handleViewZone,
  contextMenu,
  handleCardContextMenu,
  handleZoneContextMenu,
  handleBattlefieldContextMenu,
  handleLifeContextMenu,
  handleOpenCoinFlipper,
  handleOpenDiceRoller,
  closeContextMenu,
  countPrompt,
  closeCountPrompt,
  textPrompt,
  closeTextPrompt,
  isLoadDeckModalOpen,
  setIsLoadDeckModalOpen,
  isTokenModalOpen,
  setIsTokenModalOpen,
  isCoinFlipperOpen,
  setIsCoinFlipperOpen,
  isDiceRollerOpen,
  setIsDiceRollerOpen,
  isLogOpen,
  setIsLogOpen,
  isShortcutsOpen,
  setIsShortcutsOpen,
  isShareDialogOpen,
  setIsShareDialogOpen,
  zoomControlsBlocked,
  isEditUsernameOpen,
  setIsEditUsernameOpen,
  zoneViewerState,
  setZoneViewerState,
  revealedLibraryZoneId,
  setRevealedLibraryZoneId,
  preferredUsername,
  handleUsernameSubmit,
  handleDrawCard,
  handleFlipCoin,
  handleRollDice,
  handleLeave,
  shareLinks,
  shareLinksReady,
  shareDialogError,
  canShareRoom,
}) => {
  const suppressSingleOverlay = isGroupDragging && !showGroupDragOverlay;
  const showConnectingOverlay = syncStatus === "connecting";
  const activeCard = activeCardId ? cards[activeCardId] : null;
  const activeZone = activeCard ? zones[activeCard.zoneId] : undefined;
  const activeOwnerId =
    activeZone?.ownerId ?? activeCard?.ownerId ?? undefined;
  const activeSizing = activeOwnerId
    ? battlefieldGridSizing[activeOwnerId]
    : undefined;
  const activeBaseCardHeight = activeSizing?.baseCardHeightPx;
  const activeBaseCardWidth = activeSizing?.baseCardWidthPx;
  const activeViewScale =
    activeZone?.type === ZONE.BATTLEFIELD
      ? (battlefieldViewScale[activeZone.ownerId] ?? 1)
      : 1;
  const [dragBaseScale, setDragBaseScale] = React.useState(1);
  const hasActiveBaseSizing = Boolean(activeBaseCardHeight || activeBaseCardWidth);
  const overlayBaseHeight =
    activeBaseCardHeight ??
    (activeBaseCardWidth ? activeBaseCardWidth / CARD_ASPECT_RATIO : BASE_CARD_HEIGHT);
  const overlayBaseWidth =
    activeBaseCardWidth ?? overlayBaseHeight * CARD_ASPECT_RATIO;
  const overlayCardVars = hasActiveBaseSizing
    ? ({
        ["--card-h" as string]: `${overlayBaseHeight}px`,
        ["--card-w" as string]: `${overlayBaseWidth}px`,
      } as React.CSSProperties)
    : undefined;

  React.useLayoutEffect(() => {
    if (hasActiveBaseSizing) {
      if (dragBaseScale !== 1) setDragBaseScale(1);
      return;
    }
    if (!activeCardId || typeof document === "undefined") {
      setDragBaseScale(1);
      return;
    }
    const node = document.querySelector(`[data-card-id="${activeCardId}"]`);
    if (!(node instanceof HTMLElement)) {
      setDragBaseScale(1);
      return;
    }
    const rect = node.getBoundingClientRect();
    const maxDim = Math.max(rect.width, rect.height);
    const effectiveCardScale = activeCardScale || activeViewScale || 1;
    const denom = BASE_CARD_HEIGHT * scale * effectiveCardScale;
    setDragBaseScale(denom > 0 ? maxDim / denom : 1);
  }, [
    dragBaseScale,
    activeCardId,
    activeCardScale,
    activeViewScale,
    hasActiveBaseSizing,
    scale,
  ]);

  const isPortraitViewport = usePortraitViewport();
  const occupiedSlots = React.useMemo(() => slots.filter(isOccupiedSeat), [slots]);
  const defaultSeat = React.useMemo(
    () => {
      const mySeat = occupiedSlots.find((slot) => slot.player.id === myPlayerId);
      if (mySeat) return mySeat;
      for (const position of DEFAULT_SEAT_PRIORITY) {
        const match = occupiedSlots.find((slot) => slot.position === position);
        if (match) return match;
      }
      return occupiedSlots[0] ?? null;
    },
    [myPlayerId, occupiedSlots],
  );
  const [activeSeatPlayerId, setActiveSeatPlayerId] = React.useState<string | null>(
    defaultSeat?.player.id ?? null,
  );
  const [isPortraitSeatPickerExpanded, setIsPortraitSeatPickerExpanded] =
    React.useState(false);
  const [isPortraitCommanderDrawerOpen, setIsPortraitCommanderDrawerOpen] =
    React.useState(false);
  const [seatSwitchBanner, setSeatSwitchBanner] = React.useState<string | null>(null);
  const seatSwitchBannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearSeatSwitchBannerTimer = React.useCallback(() => {
    if (seatSwitchBannerTimerRef.current) {
      clearTimeout(seatSwitchBannerTimerRef.current);
      seatSwitchBannerTimerRef.current = null;
    }
  }, []);

  const showSeatSwitchBanner = React.useCallback(
    (playerLabel: string) => {
      clearSeatSwitchBannerTimer();
      setSeatSwitchBanner(playerLabel);
      seatSwitchBannerTimerRef.current = setTimeout(() => {
        seatSwitchBannerTimerRef.current = null;
        setSeatSwitchBanner(null);
      }, PORTRAIT_SEAT_BANNER_MS);
    },
    [clearSeatSwitchBannerTimer],
  );

  React.useEffect(() => {
    return () => {
      clearSeatSwitchBannerTimer();
    };
  }, [clearSeatSwitchBannerTimer]);

  React.useEffect(() => {
    if (!defaultSeat) {
      if (activeSeatPlayerId !== null) setActiveSeatPlayerId(null);
      return;
    }
    if (!activeSeatPlayerId) {
      setActiveSeatPlayerId(defaultSeat.player.id);
      return;
    }
    const exists = occupiedSlots.some((slot) => slot.player.id === activeSeatPlayerId);
    if (!exists) {
      setActiveSeatPlayerId(defaultSeat.player.id);
    }
  }, [activeSeatPlayerId, defaultSeat, occupiedSlots]);

  const activeSeat = React.useMemo(
    () =>
      occupiedSlots.find((slot) => slot.player.id === activeSeatPlayerId) ??
      defaultSeat,
    [activeSeatPlayerId, defaultSeat, occupiedSlots],
  );

  const activateSeat = React.useCallback(
    (playerId: string, announce = false) => {
      if (playerId === activeSeatPlayerId) return;
      if (announce) {
        const nextSeat = occupiedSlots.find((slot) => slot.player.id === playerId);
        if (nextSeat) {
          showSeatSwitchBanner(getSeatDisplayName(nextSeat.player, myPlayerId));
        }
      }
      setActiveSeatPlayerId(playerId);
    },
    [activeSeatPlayerId, myPlayerId, occupiedSlots, showSeatSwitchBanner],
  );

  React.useEffect(() => {
    setIsPortraitCommanderDrawerOpen(false);
  }, [activeSeat?.player.id]);

  const swipeTouchPointsRef = React.useRef<
    Map<number, { x: number; y: number; eligible: boolean }>
  >(new Map());
  const swipeGestureRef = React.useRef<{
    pointerIds: [number, number];
    startMidpointX: number;
    startMidpointY: number;
    startedAt: number;
  } | null>(null);

  const clearSwipeGesture = React.useCallback(() => {
    swipeTouchPointsRef.current.clear();
    swipeGestureRef.current = null;
  }, []);

  React.useEffect(() => {
    if (isPortraitViewport) return;
    clearSwipeGesture();
  }, [clearSwipeGesture, isPortraitViewport]);

  const handleViewportPointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPortraitViewport) return;
      if (event.pointerType !== "touch" || event.button !== 0) return;
      const target = event.target;
      const isBlockedTarget =
        target instanceof HTMLElement &&
        Boolean(target.closest(SEAT_SWIPE_BLOCK_SELECTOR));

      swipeTouchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        eligible: !isBlockedTarget,
      });

      if (swipeGestureRef.current) return;
      const eligibleTouches = Array.from(swipeTouchPointsRef.current.entries()).filter(
        ([, point]) => point.eligible,
      );
      if (eligibleTouches.length < 2) return;

      const [firstTouch, secondTouch] = eligibleTouches.slice(-2);
      swipeGestureRef.current = {
        pointerIds: [firstTouch[0], secondTouch[0]],
        startMidpointX: (firstTouch[1].x + secondTouch[1].x) / 2,
        startMidpointY: (firstTouch[1].y + secondTouch[1].y) / 2,
        startedAt: Date.now(),
      };
    },
    [isPortraitViewport],
  );

  const handleViewportPointerMoveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPortraitViewport) return;
      if (event.pointerType !== "touch") return;
      const point = swipeTouchPointsRef.current.get(event.pointerId);
      if (!point) return;
      point.x = event.clientX;
      point.y = event.clientY;
    },
    [isPortraitViewport],
  );

  const handleViewportPointerEndCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPortraitViewport) return;
      if (event.pointerType !== "touch") return;

      const point = swipeTouchPointsRef.current.get(event.pointerId);
      if (point) {
        point.x = event.clientX;
        point.y = event.clientY;
      }

      const swipeGesture = swipeGestureRef.current;
      if (!swipeGesture) {
        swipeTouchPointsRef.current.delete(event.pointerId);
        return;
      }
      if (!swipeGesture.pointerIds.includes(event.pointerId)) {
        swipeTouchPointsRef.current.delete(event.pointerId);
        return;
      }

      if (!activeSeat) {
        swipeGestureRef.current = null;
        swipeTouchPointsRef.current.delete(event.pointerId);
        return;
      }

      const firstTouch = swipeTouchPointsRef.current.get(swipeGesture.pointerIds[0]);
      const secondTouch = swipeTouchPointsRef.current.get(swipeGesture.pointerIds[1]);
      swipeGestureRef.current = null;
      swipeTouchPointsRef.current.delete(event.pointerId);

      if (!firstTouch || !secondTouch) return;

      const elapsed = Date.now() - swipeGesture.startedAt;
      if (elapsed > MOBILE_SWIPE_MAX_DURATION_MS) return;

      const deltaX =
        (firstTouch.x + secondTouch.x) / 2 - swipeGesture.startMidpointX;
      const deltaY =
        (firstTouch.y + secondTouch.y) / 2 - swipeGesture.startMidpointY;

      const nextSeat = resolveSwipeTargetSeat(
        activeSeat,
        occupiedSlots,
        deltaX,
        deltaY,
      );
      if (!nextSeat) return;
      if (nextSeat.player.id === activeSeat.player.id) return;
      activateSeat(nextSeat.player.id, true);
    },
    [activeSeat, activateSeat, isPortraitViewport, occupiedSlots],
  );

  const renderSeat = (
    slot: SeatSlot,
    key: React.Key,
    layoutVariant: "default" | "portrait-viewport" = "default",
    onPortraitCommanderDrawerOpenChange?: (open: boolean) => void,
  ) => {
    const seatPlayer = slot.player;
    if (!seatPlayer) {
      return (
        <div key={key} className="relative h-full w-full border-zinc-800/50">
          <div className="w-full h-full flex items-center justify-center text-zinc-800 font-bold text-2xl uppercase tracking-widest select-none">
            Empty Seat
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="relative h-full w-full border-zinc-800/50">
        <Seat
          player={seatPlayer}
          position={slot.position}
          color={slot.color}
          zones={zones}
          cards={cards}
          libraryRevealsToAll={libraryRevealsToAll}
          isMe={seatPlayer.id === myPlayerId}
          viewerPlayerId={myPlayerId}
          viewerRole={viewerRole}
          onCardContextMenu={handleCardContextMenu}
          onZoneContextMenu={handleZoneContextMenu}
          onBattlefieldContextMenu={(e) =>
            handleBattlefieldContextMenu(e, {
              onCreateToken: () => setIsTokenModalOpen(true),
              onOpenDiceRoller: handleOpenDiceRoller,
            })
          }
          onLoadDeck={() => setIsLoadDeckModalOpen(true)}
          onEditUsername={
            seatPlayer.id === myPlayerId
              ? () => setIsEditUsernameOpen(true)
              : undefined
          }
          opponentColors={playerColors}
          scale={scale}
          battlefieldScale={battlefieldViewScale[seatPlayer.id] ?? 1}
          onViewZone={handleViewZone}
          onDrawCard={handleDrawCard}
          onOpponentLibraryReveals={(zoneId) => setRevealedLibraryZoneId(zoneId)}
          zoomControlsDisabled={zoomControlsBlocked}
          onLifeContextMenu={(e) => handleLifeContextMenu?.(e, seatPlayer)}
          layoutVariant={layoutVariant}
          onPortraitCommanderDrawerOpenChange={onPortraitCommanderDrawerOpenChange}
        />
      </div>
    );
  };

  const indicatorSeats = React.useMemo(() => {
    return [...occupiedSlots].sort((a, b) => {
      const aPos = SEAT_COORDS[a.position];
      const bPos = SEAT_COORDS[b.position];
      if (aPos.y !== bPos.y) return aPos.y - bPos.y;
      return aPos.x - bPos.x;
    });
  }, [occupiedSlots]);
  const hasActiveOverlayUi = Boolean(
    contextMenu ||
      activeModal ||
      countPrompt ||
      textPrompt ||
      isLoadDeckModalOpen ||
      isTokenModalOpen ||
      isCoinFlipperOpen ||
      isDiceRollerOpen ||
      isLogOpen ||
      isShortcutsOpen ||
      isShareDialogOpen ||
      isEditUsernameOpen ||
      zoneViewerState.isOpen ||
      revealedLibraryZoneId ||
      isPortraitCommanderDrawerOpen,
  );

  React.useEffect(() => {
    if (!isPortraitViewport || indicatorSeats.length <= 1 || hasActiveOverlayUi) {
      setIsPortraitSeatPickerExpanded(false);
    }
  }, [hasActiveOverlayUi, indicatorSeats.length, isPortraitViewport]);

  const handlePortraitSeatSelect = React.useCallback(
    (playerId: string) => {
      activateSeat(playerId, true);
      setIsPortraitSeatPickerExpanded(false);
    },
    [activateSeat],
  );

  return (
    <CardPreviewProvider>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        measuring={{
          draggable: { measure: getClientRect },
          dragOverlay: { measure: getClientRect },
        }}
        collisionDetection={pointerWithin}
      >
        <div
          className="ds-app-shell bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30"
          onContextMenu={(e) => e.preventDefault()}
        >
          {showConnectingOverlay && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-4 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-950/80 px-3 py-1.5 text-sm text-amber-200 shadow-lg backdrop-blur"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </div>
          )}
          {seatSwitchBanner && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-none absolute left-1/2 z-[71] -translate-x-1/2 rounded-full border border-zinc-700/80 bg-zinc-950/90 px-4 py-1.5 text-sm font-semibold text-zinc-100 shadow-lg backdrop-blur",
                showConnectingOverlay ? "top-14" : "top-4",
              )}
            >
              {seatSwitchBanner}
            </div>
          )}

          {isPortraitViewport ? (
            <div className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto]">
              <div
                className="relative min-h-0 overflow-hidden overscroll-none"
                style={{ ["--mobile-sidenav-h" as string]: "3.75rem" }}
              >
                <div className="grid h-full w-full grid-rows-[minmax(0,1fr)_var(--mobile-sidenav-h)]">
                <div
                  className="relative min-h-0 overflow-hidden overscroll-none touch-none"
                  onPointerDownCapture={handleViewportPointerDownCapture}
                  onPointerMoveCapture={handleViewportPointerMoveCapture}
                  onPointerUpCapture={handleViewportPointerEndCapture}
                  onPointerCancelCapture={handleViewportPointerEndCapture}
                  >
                    {activeSeat ? (
                      renderSeat(
                        activeSeat,
                        activeSeat.player.id,
                        "portrait-viewport",
                        setIsPortraitCommanderDrawerOpen,
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-800 font-bold text-2xl uppercase tracking-widest select-none">
                        Empty Seat
                      </div>
                    )}
                  </div>
                  <Sidenav
                    orientation="horizontal"
                    onCreateToken={() => setIsTokenModalOpen(true)}
                    onOpenCoinFlipper={handleOpenCoinFlipper}
                    onOpenDiceRoller={handleOpenDiceRoller}
                    onToggleLog={() => setIsLogOpen(!isLogOpen)}
                    isLogOpen={isLogOpen}
                    onOpenShareDialog={() => setIsShareDialogOpen(true)}
                    onLeaveGame={handleLeave}
                    onOpenShortcuts={() => setIsShortcutsOpen(true)}
                    syncStatus={syncStatus}
                    peerCounts={peerCounts}
                    isSpectator={viewerRole === "spectator"}
                    canShareRoom={canShareRoom}
                  />
                </div>
                {indicatorSeats.length > 1 && !hasActiveOverlayUi && (
                  <>
                    {isPortraitSeatPickerExpanded && (
                      <button
                        type="button"
                        aria-label="Collapse seat picker"
                        className="absolute inset-0 z-[61] bg-transparent"
                        onClick={() => setIsPortraitSeatPickerExpanded(false)}
                        data-testid="portrait-seat-indicator-backdrop"
                        data-no-seat-swipe="true"
                      />
                    )}
                    <div
                      className={`absolute inset-x-0 z-[62] flex justify-center ${
                        isPortraitCommanderDrawerOpen
                          ? "bottom-[0.4rem]"
                          : "bottom-[calc(var(--mobile-sidenav-h)+0.5rem)]"
                      }`}
                    >
                      <PortraitSeatIndicator
                        seats={indicatorSeats}
                        activeSeatPlayerId={activeSeat?.player.id ?? null}
                        myPlayerId={myPlayerId}
                        isExpanded={isPortraitSeatPickerExpanded}
                        onToggleExpanded={() => setIsPortraitSeatPickerExpanded(true)}
                        onSelectSeat={handlePortraitSeatSelect}
                      />
                    </div>
                  </>
                )}
              </div>
              <LogDrawer
                layout="stacked"
                isOpen={isLogOpen}
                onClose={() => setIsLogOpen(false)}
                playerColors={playerColors}
              />
            </div>
          ) : (
            <div className="grid h-full w-full grid-cols-[var(--sidenav-w)_minmax(0,1fr)_auto]">
              <Sidenav
                onCreateToken={() => setIsTokenModalOpen(true)}
                onOpenCoinFlipper={handleOpenCoinFlipper}
                onOpenDiceRoller={handleOpenDiceRoller}
                onToggleLog={() => setIsLogOpen(!isLogOpen)}
                isLogOpen={isLogOpen}
                onOpenShareDialog={() => setIsShareDialogOpen(true)}
                onLeaveGame={handleLeave}
                onOpenShortcuts={() => setIsShortcutsOpen(true)}
                syncStatus={syncStatus}
                peerCounts={peerCounts}
                isSpectator={viewerRole === "spectator"}
                canShareRoom={canShareRoom}
              />
              <div className={`min-w-0 h-full grid ${gridClass}`}>
                {slots.map((slot, index) => renderSeat(slot, index))}
              </div>
              <LogDrawer
                isOpen={isLogOpen}
                onClose={() => setIsLogOpen(false)}
                playerColors={playerColors}
              />
            </div>
          )}
        </div>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={closeContextMenu}
            title={contextMenu.title}
          />
        )}
        <NumberPromptDialog
          open={Boolean(countPrompt)}
          title={countPrompt?.title || ""}
          message={countPrompt?.message}
          onSubmit={(value) => countPrompt?.onSubmit(value)}
          onClose={closeCountPrompt}
          initialValue={countPrompt?.initialValue ?? 1}
          minValue={countPrompt?.minValue}
          confirmLabel={countPrompt?.confirmLabel}
        />
        <TextPromptDialog
          open={Boolean(textPrompt)}
          title={textPrompt?.title || ""}
          message={textPrompt?.message}
          initialValue={textPrompt?.initialValue}
          onSubmit={(value) => textPrompt?.onSubmit(value)}
          onClose={closeTextPrompt}
        />
        <LoadDeckModal
          isOpen={isLoadDeckModalOpen}
          onClose={() => setIsLoadDeckModalOpen(false)}
          playerId={myPlayerId}
        />
        <CoinFlipDialog
          open={isCoinFlipperOpen}
          onClose={() => setIsCoinFlipperOpen(false)}
          onFlip={handleFlipCoin}
        />
        <DiceRollDialog
          open={isDiceRollerOpen}
          onClose={() => setIsDiceRollerOpen(false)}
          onRoll={handleRollDice}
        />
        <TokenCreationModal
          isOpen={isTokenModalOpen}
          onClose={() => setIsTokenModalOpen(false)}
          playerId={myPlayerId}
        />
        <AddCounterModal
          isOpen={activeModal?.type === "ADD_COUNTER"}
          onClose={() => setActiveModal(null)}
          cardIds={
            activeModal?.type === "ADD_COUNTER" ? activeModal.cardIds : []
          }
        />
        <ZoneViewerModal
          isOpen={zoneViewerState.isOpen}
          onClose={() =>
            setZoneViewerState((prev) => ({ ...prev, isOpen: false }))
          }
          zoneId={zoneViewerState.zoneId}
          count={zoneViewerState.count}
        />
        <OpponentLibraryRevealsModal
          isOpen={Boolean(revealedLibraryZoneId)}
          onClose={() => setRevealedLibraryZoneId(null)}
          zoneId={revealedLibraryZoneId}
        />
        <ShortcutsDrawer
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
        <EditUsernameDialog
          open={isEditUsernameOpen}
          onClose={() => setIsEditUsernameOpen(false)}
          initialValue={players[myPlayerId]?.name ?? preferredUsername ?? ""}
          onSubmit={handleUsernameSubmit}
        />
        <ShareRoomDialog
          open={isShareDialogOpen}
          onClose={() => setIsShareDialogOpen(false)}
          playerLink={shareLinks.players}
          spectatorLink={shareLinks.spectators}
          resumeLink={shareLinks.resume}
          linksReady={shareLinksReady}
          errorMessage={shareDialogError}
          players={players}
          isHost={isHost}
          roomLockedByHost={roomLockedByHost}
          roomIsFull={roomIsFull}
          onToggleRoomLock={onToggleRoomLock}
        />
        <DragOverlay dropAnimation={null}>
          {showGroupDragOverlay
            ? (() => {
                const overlayCard = activeCardId ? cards[activeCardId] : null;
                if (!overlayCard) return null;
                const overlayZone = zones[overlayCard.zoneId];
                const overlayPreferArtCrop = false;
                const viewScale =
                  overlayZone?.type === ZONE.BATTLEFIELD
                    ? (battlefieldViewScale[overlayZone.ownerId] ?? 1)
                    : 1;
                const targetScale = overCardScale || viewScale;
                const overlayScale =
                  scale * targetScale * (hasActiveBaseSizing ? 1 : dragBaseScale);
                const offset = 10;
                const overlayCards = groupDragCardIds
                  .map((id) => cards[id])
                  .filter((card): card is (typeof cards)[string] =>
                    Boolean(card)
                  )
                  .slice(0, 4);
                if (overlayCards.length === 0) return null;
                const extraCount = Math.max(
                  0,
                  groupDragCardIds.length - overlayCards.length
                );
                const baseWidth = overlayBaseWidth;
                const baseHeight = overlayBaseHeight;
                const stackWidth =
                  baseWidth + offset * Math.max(0, overlayCards.length - 1);
                const stackHeight =
                  baseHeight + offset * Math.max(0, overlayCards.length - 1);

                return (
                  <div
                    style={{
                      ...(overlayCardVars ?? {}),
                      transform: `scale(${overlayScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <div
                      className="relative"
                      style={{ width: stackWidth, height: stackHeight }}
                    >
                      {overlayCards.map((card, index) => {
                        const overlayZoneType = zones[card.zoneId]?.type;
                        const faceDown =
                          overlayZoneType === ZONE.LIBRARY
                            ? true
                            : shouldRenderFaceDown(
                                card,
                                overlayZoneType,
                                myPlayerId,
                                viewerRole
                              );

                        return (
                          <div
                            key={card.id}
                            className="absolute"
                            style={{
                              left: index * offset,
                              top: index * offset,
                            }}
                          >
                            <CardView
                              card={card}
                              isDragging
                              preferArtCrop={overlayPreferArtCrop}
                              faceDown={faceDown}
                            />
                          </div>
                        );
                      })}
                      {extraCount > 0 && (
                        <div className="absolute -bottom-2 -right-2 rounded-full bg-zinc-900/80 text-zinc-100 text-xs px-1.5 py-0.5 border border-zinc-700">
                          +{extraCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            : activeCardId && cards[activeCardId] && !suppressSingleOverlay
              ? (() => {
                  const overlayCard = cards[activeCardId];
                  const overlayZone = zones[overlayCard.zoneId];
                  const overlayPreferArtCrop = false;
                  const viewScale =
                    overlayZone?.type === ZONE.BATTLEFIELD
                      ? (battlefieldViewScale[overlayZone.ownerId] ?? 1)
                      : 1;
                  const targetScale = overCardScale || viewScale;
                  const overlayScale =
                    scale * targetScale * (hasActiveBaseSizing ? 1 : dragBaseScale);
                  const overlayFaceDown =
                    overlayZone?.type === ZONE.LIBRARY
                      ? true
                      : shouldRenderFaceDown(
                          overlayCard,
                          overlayZone?.type,
                          myPlayerId,
                          viewerRole
                        );
                  return (
                    <div
                      style={{
                        ...(overlayCardVars ?? {}),
                        transform: `scale(${overlayScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <CardView
                        card={overlayCard}
                        isDragging
                        preferArtCrop={overlayPreferArtCrop}
                        faceDown={overlayFaceDown}
                      />
                    </div>
                  );
                })()
              : null}
        </DragOverlay>
      </DndContext>
    </CardPreviewProvider>
  );
};
