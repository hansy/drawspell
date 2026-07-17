import React from "react";
import { Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  getClientRect,
  type DragMoveEvent,
} from "@dnd-kit/core";

import { ZONE } from "@/constants/zones";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import { debugLog, isDebugEnabled, summarizeDndCardGeometry } from "@/lib/debug";
import {
  computeAnchoredResizeOffset,
  computeDragOverlayBaseScale,
} from "@/lib/dndBattlefield";
import { cn } from "@/lib/utils";
import { CardPreviewProvider } from "../card/CardPreviewProvider";
import { shouldRenderFaceDown } from "@/lib/reveal";
import { CardDragOverlayView } from "./CardDragOverlayView";
import { ZONE_DRAG_OVERLAY_POINTER_OFFSET_PX } from "@/lib/dndDragCue";
import { bottomBarAwarePointerWithin } from "@/lib/bottomBarCollision";
import { Seat } from "../seat/Seat";
import { PortraitSeatSwitcher } from "../seat/PortraitSeatSwitcher";
import { LogDrawer } from "../log-drawer/LogDrawer";
import { Sidenav } from "../sidenav/Sidenav";
import {
  COARSE_POINTER_QUERY,
  getPortraitViewportMatch,
  NARROW_VIEWPORT_QUERY,
  PORTRAIT_ORIENTATION_QUERY,
} from "@/models/game/board/viewportModel";

import type { MultiplayerBoardController } from "@/hooks/game/board/useMultiplayerBoardController";

const AddCounterModal = React.lazy(() =>
  import("../add-counter/AddCounterModal").then((module) => ({
    default: module.AddCounterModal,
  })),
);
const CoinFlipDialog = React.lazy(() =>
  import("../coin/CoinFlipDialog").then((module) => ({
    default: module.CoinFlipDialog,
  })),
);
const ContextMenu = React.lazy(() =>
  import("../context-menu/ContextMenu").then((module) => ({
    default: module.ContextMenu,
  })),
);
const DiceRollDialog = React.lazy(() =>
  import("../dice/DiceRollDialog").then((module) => ({
    default: module.DiceRollDialog,
  })),
);
const EditUsernameDialog = React.lazy(() =>
  import("@/components/username/EditUsernameDialog").then((module) => ({
    default: module.EditUsernameDialog,
  })),
);
const NumberPromptDialog = React.lazy(() =>
  import("../prompts/NumberPromptDialog").then((module) => ({
    default: module.NumberPromptDialog,
  })),
);
const TextPromptDialog = React.lazy(() =>
  import("../prompts/TextPromptDialog").then((module) => ({
    default: module.TextPromptDialog,
  })),
);
const LoadDeckModal = React.lazy(() =>
  import("../load-deck/LoadDeckModal").then((module) => ({ default: module.LoadDeckModal })),
);
const OpponentLibraryRevealsModal = React.lazy(() =>
  import("../opponent-library-reveals/OpponentLibraryRevealsModal").then((module) => ({
    default: module.OpponentLibraryRevealsModal,
  })),
);
const ShortcutsDrawer = React.lazy(() =>
  import("../shortcuts/ShortcutsDrawer").then((module) => ({ default: module.ShortcutsDrawer })),
);
const TokenCreationModal = React.lazy(() =>
  import("../token-creation/TokenCreationModal").then((module) => ({
    default: module.TokenCreationModal,
  })),
);
const ZoneViewerModal = React.lazy(() =>
  import("../zone-viewer/ZoneViewerModal").then((module) => ({ default: module.ZoneViewerModal })),
);
const ShareRoomDialog = React.lazy(() =>
  import("@/components/game/share/ShareRoomDialog").then((module) => ({
    default: module.ShareRoomDialog,
  })),
);

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
    return getPortraitViewportMatch(window.matchMedia);
  }, []);

  const [matches, setMatches] = React.useState(getMatches);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const orientationMedia = window.matchMedia(PORTRAIT_ORIENTATION_QUERY);
    const pointerMedia = window.matchMedia(COARSE_POINTER_QUERY);
    const narrowMedia = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const sync = () =>
      setMatches(getPortraitViewportMatch(window.matchMedia));

    sync();
    orientationMedia.addEventListener?.("change", sync);
    pointerMedia.addEventListener?.("change", sync);
    narrowMedia.addEventListener?.("change", sync);

    return () => {
      orientationMedia.removeEventListener?.("change", sync);
      pointerMedia.removeEventListener?.("change", sync);
      narrowMedia.removeEventListener?.("change", sync);
    };
  }, []);

  return matches;
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
  dragOverlayScale,
  dragOverlayCue,
  activeCardId,
  activeCardScale,
  activeCardTransformOrigin,
  activeCardDragAnchor,
  activeCardSourceSize,
  isGroupDragging,
  showGroupDragOverlay,
  groupDragCardIds,
  sensors,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  syncStatus,
  peerCounts,
  handleViewZone,
  contextMenu,
  handleCardContextMenu,
  handleHandContextMenu,
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
  handleEndTurn,
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
  const hasActiveBaseSizing = Boolean(activeBaseCardHeight || activeBaseCardWidth);
  const overlayBaseHeight =
    activeBaseCardHeight ??
    (activeBaseCardWidth ? activeBaseCardWidth / CARD_ASPECT_RATIO : BASE_CARD_HEIGHT);
  const overlayBaseWidth =
    activeBaseCardWidth ?? overlayBaseHeight * CARD_ASPECT_RATIO;
  const dragBaseScale = React.useMemo(() => {
    if (hasActiveBaseSizing) return 1;

    return computeDragOverlayBaseScale({
      sourceWidth: activeCardSourceSize?.width,
      sourceHeight: activeCardSourceSize?.height,
      sourceScale: activeCardScale || activeViewScale || 1,
      baseCardWidth: overlayBaseWidth,
      baseCardHeight: overlayBaseHeight,
      isTapped: Boolean(activeCard?.tapped),
    });
  }, [
    activeCard?.tapped,
    activeCardScale,
    activeCardSourceSize,
    activeViewScale,
    hasActiveBaseSizing,
    overlayBaseHeight,
    overlayBaseWidth,
  ]);
  const overlayCardVars = hasActiveBaseSizing
    ? ({
        ["--card-h" as string]: `${overlayBaseHeight}px`,
        ["--card-w" as string]: `${overlayBaseWidth}px`,
      } as React.CSSProperties)
    : undefined;
  const activeOverlayTargetScale =
    dragOverlayScale !== 1 ? dragOverlayScale : overCardScale || activeViewScale;
  const activeOverlayScale =
    scale * activeOverlayTargetScale * (hasActiveBaseSizing ? 1 : dragBaseScale);

  const getOverlayVisualSize = React.useCallback(
    (card: typeof activeCard, overlayScale: number) => {
      if (!card) return null;
      return {
        width: (card.tapped ? overlayBaseHeight : overlayBaseWidth) * overlayScale,
        height: (card.tapped ? overlayBaseWidth : overlayBaseHeight) * overlayScale,
      };
    },
    [overlayBaseHeight, overlayBaseWidth]
  );

  const getAnchoredOverlayTransform = React.useCallback(
    (card: typeof activeCard, overlayScale: number) => {
      const visualSize = getOverlayVisualSize(card, overlayScale);
      const offset =
        activeCardDragAnchor && activeCardSourceSize && visualSize
          ? computeAnchoredResizeOffset({
              dragAnchor: activeCardDragAnchor,
              sourceWidth: activeCardSourceSize.width,
              sourceHeight: activeCardSourceSize.height,
              sourceOffsetX: activeCardSourceSize.offsetX,
              sourceOffsetY: activeCardSourceSize.offsetY,
              targetWidth: visualSize.width,
              targetHeight: visualSize.height,
            })
          : { x: 0, y: 0 };

      const pointerOffset =
        dragOverlayCue === "zone" ? ZONE_DRAG_OVERLAY_POINTER_OFFSET_PX : 0;

      return {
        transform: `translate(${offset.x + pointerOffset}px, ${offset.y + pointerOffset}px) scale(${overlayScale})`,
        transformOrigin: "top left",
        offset,
        visualSize,
      };
    },
    [activeCardDragAnchor, activeCardSourceSize, dragOverlayCue, getOverlayVisualSize]
  );

  React.useEffect(() => {
    if (!activeCardId || !activeCard) return;
    if (!isDebugEnabled("battlefieldDnd")) return;
    debugLog("battlefieldDnd", "drag-overlay-sizing", {
      activeCardId,
      cardState: {
        zoneId: activeCard.zoneId,
        tapped: activeCard.tapped,
        position: activeCard.position,
        rotation: activeCard.rotation,
      },
      activeZone: activeZone
        ? {
            id: activeZone.id,
            type: activeZone.type,
            ownerId: activeZone.ownerId,
          }
        : null,
      scale,
      overCardScale,
      activeCardScale,
      activeViewScale,
      activeOverlayTargetScale,
      dragBaseScale,
      hasActiveBaseSizing,
      activeBaseCardHeight,
      activeBaseCardWidth,
      overlayBaseHeight,
      overlayBaseWidth,
      overlayScale: activeOverlayScale,
      activeCardTransformOrigin,
      activeCardDragAnchor,
      activeCardSourceSize,
      anchoredOverlay: getAnchoredOverlayTransform(activeCard, activeOverlayScale),
      dndGeometry: summarizeDndCardGeometry(activeCardId),
    });
  }, [
    activeBaseCardHeight,
    activeBaseCardWidth,
    activeCard,
    activeCardId,
    activeCardScale,
    activeCardTransformOrigin,
    activeCardDragAnchor,
    activeCardSourceSize,
    activeOverlayScale,
    activeOverlayTargetScale,
    activeViewScale,
    activeZone,
    dragBaseScale,
    hasActiveBaseSizing,
    overCardScale,
    overlayBaseHeight,
    overlayBaseWidth,
    scale,
    getAnchoredOverlayTransform,
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
  const [isPortraitSidenavMenuOpen, setIsPortraitSidenavMenuOpen] =
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
          onHandContextMenu={handleHandContextMenu}
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
          portraitSeatSwitcher={
            layoutVariant === "portrait-viewport" ? portraitSeatSwitcher : undefined
          }
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
      isPortraitSidenavMenuOpen,
  );
  const shouldShowPortraitSeatSwitcher =
    indicatorSeats.length > 1 && peerCounts.players > 1;

  React.useEffect(() => {
    if (!isPortraitViewport || !shouldShowPortraitSeatSwitcher || hasActiveOverlayUi) {
      setIsPortraitSeatPickerExpanded(false);
    }
  }, [hasActiveOverlayUi, isPortraitViewport, shouldShowPortraitSeatSwitcher]);

  React.useEffect(() => {
    if (!isPortraitViewport) {
      setIsPortraitSidenavMenuOpen(false);
    }
  }, [isPortraitViewport]);

  const handlePortraitSeatSelect = React.useCallback(
    (playerId: string) => {
      activateSeat(playerId, true);
      setIsPortraitSeatPickerExpanded(false);
    },
    [activateSeat],
  );

  const portraitSeatSwitcher = shouldShowPortraitSeatSwitcher && !hasActiveOverlayUi ? (
    <PortraitSeatSwitcher
      seats={indicatorSeats.map((slot) => ({
        playerId: slot.player.id,
        label: getSeatDisplayName(slot.player, myPlayerId),
        color: slot.color,
      }))}
      activePlayerId={activeSeat?.player.id ?? null}
      open={isPortraitSeatPickerExpanded}
      onOpenChange={setIsPortraitSeatPickerExpanded}
      onSelectSeat={handlePortraitSeatSelect}
    />
  ) : null;

  const handleBoardDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      if (contextMenu && Math.hypot(event.delta.x, event.delta.y) > 2) {
        closeContextMenu();
      }
      handleDragMove(event);
    },
    [closeContextMenu, contextMenu, handleDragMove],
  );

  return (
    <CardPreviewProvider>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleBoardDragMove}
        onDragEnd={handleDragEnd}
        measuring={{
          draggable: { measure: getClientRect },
          dragOverlay: { measure: getClientRect },
        }}
        autoScroll={{
          layoutShiftCompensation: { x: false, y: true },
        }}
        collisionDetection={bottomBarAwarePointerWithin}
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
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              Connecting
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
                    onEndTurn={handleEndTurn}
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
                    onMenuOpenChange={setIsPortraitSidenavMenuOpen}
                  />
                </div>
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
                onEndTurn={handleEndTurn}
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
        <React.Suspense fallback={null}>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={contextMenu.items}
              onClose={closeContextMenu}
              title={contextMenu.title}
            />
          )}
          {countPrompt && (
            <NumberPromptDialog
              open
              title={countPrompt.title || ""}
              message={countPrompt.message}
              onSubmit={(value) => countPrompt.onSubmit(value)}
              onClose={closeCountPrompt}
              initialValue={countPrompt.initialValue ?? 1}
              minValue={countPrompt.minValue}
              maxValue={countPrompt.maxValue}
              inputLabel={countPrompt.inputLabel}
              showMaxButton={countPrompt.showMaxButton}
              confirmLabel={countPrompt.confirmLabel}
            />
          )}
          {textPrompt && (
            <TextPromptDialog
              open
              title={textPrompt.title || ""}
              message={textPrompt.message}
              initialValue={textPrompt.initialValue}
              onSubmit={(value) => textPrompt.onSubmit(value)}
              onClose={closeTextPrompt}
            />
          )}
          {isLoadDeckModalOpen && (
            <LoadDeckModal
              isOpen
              onClose={() => setIsLoadDeckModalOpen(false)}
              playerId={myPlayerId}
            />
          )}
          {isCoinFlipperOpen && (
            <CoinFlipDialog
              open
              onClose={() => setIsCoinFlipperOpen(false)}
              onFlip={handleFlipCoin}
            />
          )}
          {isDiceRollerOpen && (
            <DiceRollDialog
              open
              onClose={() => setIsDiceRollerOpen(false)}
              onRoll={handleRollDice}
            />
          )}
          {isTokenModalOpen && (
            <TokenCreationModal
              isOpen
              onClose={() => setIsTokenModalOpen(false)}
              playerId={myPlayerId}
            />
          )}
          {activeModal?.type === "ADD_COUNTER" && (
            <AddCounterModal
              isOpen
              onClose={() => setActiveModal(null)}
              cardIds={activeModal.cardIds}
            />
          )}
          {zoneViewerState.isOpen && (
            <ZoneViewerModal
              isOpen
              onClose={() =>
                setZoneViewerState((prev) => ({ ...prev, isOpen: false }))
              }
              zoneId={zoneViewerState.zoneId}
              count={zoneViewerState.count}
            />
          )}
          {revealedLibraryZoneId && (
            <OpponentLibraryRevealsModal
              isOpen
              onClose={() => setRevealedLibraryZoneId(null)}
              zoneId={revealedLibraryZoneId}
            />
          )}
          {isShortcutsOpen && (
            <ShortcutsDrawer isOpen onClose={() => setIsShortcutsOpen(false)} />
          )}
          {isEditUsernameOpen && (
            <EditUsernameDialog
              open
              onClose={() => setIsEditUsernameOpen(false)}
              initialValue={players[myPlayerId]?.name ?? preferredUsername ?? ""}
              onSubmit={handleUsernameSubmit}
            />
          )}
          {isShareDialogOpen && (
            <ShareRoomDialog
              open
              onClose={() => setIsShareDialogOpen(false)}
              playerLink={shareLinks.players}
              spectatorLink={shareLinks.spectators}
              resumeLink={shareLinks.resume}
              linksReady={shareLinksReady}
              errorMessage={shareDialogError}
              players={players}
            />
          )}
        </React.Suspense>
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
                const targetScale =
                  dragOverlayScale !== 1
                    ? dragOverlayScale
                    : overCardScale || viewScale;
                const overlayScale =
                  scale * targetScale * (hasActiveBaseSizing ? 1 : dragBaseScale);
                const anchoredOverlay = getAnchoredOverlayTransform(
                  overlayCard,
                  overlayScale
                );
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
                    data-dnd-drag-overlay-card-id={overlayCard.id}
                    data-dnd-drag-overlay-kind="group"
                    className="transition-transform duration-150 ease-out motion-reduce:transition-none"
                    style={{
                      ...(overlayCardVars ?? {}),
                      transform: anchoredOverlay.transform,
                      transformOrigin: anchoredOverlay.transformOrigin,
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
                            <CardDragOverlayView
                              card={card}
                              preferArtCrop={overlayPreferArtCrop}
                              faceDown={faceDown}
                              data-dnd-drag-overlay-card-view-id={card.id}
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
                  const targetScale =
                    dragOverlayScale !== 1
                      ? dragOverlayScale
                      : overCardScale || viewScale;
                  const overlayScale =
                    scale * targetScale * (hasActiveBaseSizing ? 1 : dragBaseScale);
                  const anchoredOverlay = getAnchoredOverlayTransform(
                    overlayCard,
                    overlayScale
                  );
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
                      data-dnd-drag-overlay-card-id={overlayCard.id}
                      data-dnd-drag-overlay-kind="single"
                      className="transition-transform duration-150 ease-out motion-reduce:transition-none"
                      style={{
                        ...(overlayCardVars ?? {}),
                        transform: anchoredOverlay.transform,
                        transformOrigin: anchoredOverlay.transformOrigin,
                      }}
                    >
                      <CardDragOverlayView
                        card={overlayCard}
                        preferArtCrop={overlayPreferArtCrop}
                        faceDown={overlayFaceDown}
                        data-dnd-drag-overlay-card-view-id={overlayCard.id}
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
