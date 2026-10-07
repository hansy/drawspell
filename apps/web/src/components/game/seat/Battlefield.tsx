import { getBattlefieldCameraPan } from "@/lib/battlefieldCamera";
import {
  BASE_CARD_HEIGHT,
  CARD_ASPECT_RATIO,
  LEGACY_BATTLEFIELD_WIDTH,
  LEGACY_BATTLEFIELD_HEIGHT,
} from "@mtg/shared/constants/geometry";
import {
  getBattlefieldWorldRect,
  type BattlefieldCamera,
} from "@/lib/battlefieldCamera";
import { useBattlefieldCamera } from "@/hooks/game/board/useBattlefieldCamera";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import {
  Zone as ZoneType,
  Card as CardType,
  Player,
  ViewerRole,
} from "@/types";
import { Card } from "../card/Card";
import { Zone } from "../zone/Zone";
import { useDragStore } from "@/store/dragStore";
import { useGameStore } from "@/store/gameStore";
import {
  selectIsCardSelected,
  useSelectionStore,
} from "@/store/selectionStore";
import {
  computeBattlefieldCardLayout,
  computeBattlefieldGridGeometry,
} from "@/models/game/seat/battlefieldModel";
import { useElementSize } from "@/hooks/shared/useElementSize";
import { useBattlefieldSelection } from "@/hooks/game/board/useBattlefieldSelection";
import { BattlefieldGridOverlay } from "./BattlefieldGridOverlay";
import { BattlefieldZoomIndicator } from "./BattlefieldZoomIndicator";
import { BattlefieldGhostOverlay } from "./BattlefieldGhostOverlay";
import { hasPendingDropVisualClaim } from "@/lib/dndVisualOwnership";

interface BattlefieldProps {
  zone: ZoneType;
  cards: CardType[];
  player: Player;
  isTop: boolean;
  isMe?: boolean;
  viewerPlayerId: string;
  viewerRole?: ViewerRole;
  scale?: number;
  onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
  playerColors: Record<string, string>;
  disableZoomControls?: boolean;
}

const EMPTY_SELECTED_CARD_IDS: string[] = [];

// Memoized card wrapper to prevent unnecessary re-renders
const BattlefieldCard = React.memo<{
  card: CardType;
  zoneWidth: number;
  zoneHeight: number;
  viewerPlayerId: string;
  viewerRole?: ViewerRole;
  mirrorBattlefieldY: boolean;
  isTop: boolean;
  camera: BattlefieldCamera;
  viewScale: number;
  cameraAnimating: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
  onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
  playerColors: Record<string, string>;
  renderedZoneId: string;
  zoneOwnerId: string;
  overrideIsDragging?: boolean;
  disableInteractions?: boolean;
}>(
  ({
    card,
    zoneWidth,
    zoneHeight,
    viewerPlayerId,
    viewerRole,
    mirrorBattlefieldY,
    isTop,
    viewScale,
    cameraAnimating,
    camera,
    baseCardHeight,
    baseCardWidth,
    onCardContextMenu,
    playerColors,
    renderedZoneId,
    zoneOwnerId,
    overrideIsDragging,
    disableInteractions,
  }) => {
    const { left, top, highlightColor, disableDrag } =
      computeBattlefieldCardLayout({
        card,
        zoneOwnerId,
        viewerPlayerId,
        zoneWidth,
        zoneHeight,
        mirrorBattlefieldY,
        playerColors,
        baseCardHeight,
        baseCardWidth,
        camera,
      });
    const spectatorDragDisabled = viewerRole === "spectator";
    const isSelected = useSelectionStore((state) =>
      selectIsCardSelected(state, card.id, card.zoneId),
    );
    const isPendingDropSource = useDragStore((state) =>
      hasPendingDropVisualClaim(
        state.pendingDropVisualClaims,
        card.id,
        renderedZoneId,
      ),
    );
    const isSourceVisualSuppressed =
      Boolean(overrideIsDragging) || isPendingDropSource;

    const style = React.useMemo(
      () => ({
        position: "absolute" as const,
        left,
        top,
        transform: isTop ? "rotate(180deg)" : undefined,
        transformOrigin: "center center",
        width: BASE_CARD_HEIGHT * CARD_ASPECT_RATIO,
        height: BASE_CARD_HEIGHT,
        transition: cameraAnimating ? "none" : undefined,
      }),
      [isTop, left, top, cameraAnimating],
    );

    const handleContextMenu = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCardContextMenu?.(e, card);
      },
      [onCardContextMenu, card],
    );

    return (
      <Card
        card={card}
        isTopSeat={isTop}
        style={style}
        onContextMenu={handleContextMenu}
        scale={viewScale}
        faceDown={card.faceDown}
        highlightColor={highlightColor}
        isSelected={isSelected}
        isDragging={isSourceVisualSuppressed ? true : undefined}
        className={isPendingDropSource ? "opacity-0" : undefined}
        disableDrag={disableDrag || spectatorDragDisabled}
        disableInteractions={disableInteractions || isPendingDropSource}
      />
    );
  },
);

BattlefieldCard.displayName = "BattlefieldCard";

const BattlefieldInner: React.FC<BattlefieldProps> = ({
  zone,
  cards,
  player,
  isTop,
  isMe,
  viewerPlayerId,
  viewerRole,
  scale = 1,
  onCardContextMenu,
  playerColors,
  disableZoomControls,
}) => {
  const activeCardId = useDragStore((state) => state.activeCardId);
  const ghostCards = useDragStore((state) => state.ghostCards);
  const isGroupDragging = useDragStore((state) => state.isGroupDragging);
  const { ref: sizeRef, size } = useElementSize<HTMLDivElement>();
  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const setRef = React.useCallback(
    (next: HTMLDivElement | null) => {
      sizeRef(next);
      nodeRef.current = next;
      setNode(next);
    },
    [sizeRef],
  );
  const controls = useBattlefieldCamera({
    playerId: zone.ownerId,
    width: size.width,
    height: size.height,
    reversed: isTop,
    node,
    blocked: disableZoomControls || Boolean(activeCardId),
  });
  const { camera } = controls;
  const cardWidth = BASE_CARD_HEIGHT * CARD_ASPECT_RATIO;
  const grid = computeBattlefieldGridGeometry({
    zoneWidth: LEGACY_BATTLEFIELD_WIDTH * camera.scale,
    zoneHeight: LEGACY_BATTLEFIELD_HEIGHT * camera.scale,
  });
  const setSizing = useGameStore((state) => state.setBattlefieldGridSizing);
  React.useEffect(() => {
    if (!size.width || !size.height) return;
    const pan = getBattlefieldCameraPan(camera, size.width, size.height);
    const direction = camera.reversed ? -1 : 1;
    setSizing(zone.ownerId, {
      startingAnchor: {x: -direction * pan.x / LEGACY_BATTLEFIELD_WIDTH, y: -direction * pan.y / LEGACY_BATTLEFIELD_HEIGHT},
      zoneWidthPx: LEGACY_BATTLEFIELD_WIDTH,
      zoneHeightPx: LEGACY_BATTLEFIELD_HEIGHT,
      baseCardHeightPx: BASE_CARD_HEIGHT,
      baseCardWidthPx: cardWidth,
      camera,
    });
  }, [size.width, size.height, camera, cardWidth, zone.ownerId, setSizing]);
  React.useEffect(
    () => () => setSizing(zone.ownerId, null),
    [setSizing, zone.ownerId],
  );
  const selectedCardIds = useSelectionStore(
    useShallow((state) =>
      isGroupDragging && state.selectionZoneId === zone.id
        ? state.selectedCardIds
        : EMPTY_SELECTED_CARD_IDS,
    ),
  );
  const selection = useBattlefieldSelection({
    zoneId: zone.id,
    cards,
    zoneSize: size,
    scale,
    viewScale: camera.scale,
    baseCardHeight: BASE_CARD_HEIGHT,
    baseCardWidth: cardWidth,
    mirrorBattlefieldY: isTop,
    camera,
    zoneNodeRef: nodeRef,
    isSelectionEnabled: Boolean(
      isMe && zone.ownerId === viewerPlayerId && !controls.isPanning,
    ),
  });
  const groupGhosts = React.useMemo(
    () => ghostCards?.filter((g) => g.zoneId === zone.id) ?? [],
    [ghostCards, zone.id],
  );
  const sourceCards = useGameStore(
    useShallow((state) => groupGhosts.map((g) => state.cards[g.cardId])),
  );
  const ghosts =
    groupGhosts.length < 2
      ? []
      : groupGhosts.flatMap((g, i) => {
          const card = sourceCards[i];
          return card
            ? [{ card, position: g.position, tapped: g.tapped ?? card.tapped }]
            : [];
        });
  const worldRect = getBattlefieldWorldRect(camera);
  const displayedWidth = cardWidth * camera.scale * scale;
  const actualScale = Math.max(0.01, camera.scale * scale);
  const vars = {
    "--card-h": `${BASE_CARD_HEIGHT}px`,
    "--card-w": `${cardWidth}px`,
    "--battlefield-pt-font": `${Math.max(14, 12 / actualScale)}px`,
    "--battlefield-counter-font": `${Math.max(10, 12 / actualScale)}px`,
    "--battlefield-counter-size": `${Math.max(24, 18 / actualScale)}px`,
  } as React.CSSProperties;
  const suppressContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      className={cn(
        "flex-1 relative min-w-0 min-h-0 overflow-hidden",
        isTop ? "order-last" : "order-first",
      )}
      data-battlefield-camera
      data-camera-zoom={controls.zoom}
      data-camera-panning={controls.isPanning}
      onContextMenu={suppressContextMenu}
    >
      <Zone
        zone={zone}
        layout="free-form"
        scale={scale}
        cardScale={camera.scale}
        cardBaseHeight={BASE_CARD_HEIGHT}
        cardBaseWidth={cardWidth}
        mirrorY={isTop}
        camera={camera}
        innerRef={setRef}
        style={vars}
        className={cn(
          "w-full h-full relative touch-none overflow-hidden",
          controls.isPanning && "cursor-grabbing",
          displayedWidth < 64 &&
            "[&_[data-card-name-label]]:hidden [&_[data-card-custom-text]]:hidden",
          displayedWidth < 42 &&
            "[&_[data-card-pt-badge]]:hidden [&_[data-card-counters]]:hidden",
        )}
        onContextMenu={suppressContextMenu}
        onPointerDown={(e) => {
          if (!controls.onPointerDown(e)) selection.handlePointerDown(e);
        }}
        onPointerMove={(e) => {
          if (!controls.onPointerMove(e)) selection.handlePointerMove(e);
        }}
        onPointerUp={(e) => {
          if (!controls.onPointerUp(e)) selection.handlePointerUp(e);
        }}
        onPointerCancel={(e) => {
          controls.onPointerUp(e);
          selection.handlePointerCancel(e);
        }}
      >
        <div
          data-battlefield-boundary
          className="pointer-events-none absolute"
          style={worldRect}
        />
        <BattlefieldGridOverlay
          bounds={worldRect}
          visible={Boolean(activeCardId) || controls.isPanning}
          gridStepX={grid.gridStepX}
          gridStepY={grid.gridStepY}
          gridOriginX={camera.offset.x}
          gridOriginY={camera.offset.y + grid.gridOriginY}
        />
        {selection.selectionRect && (
          <div
            className="pointer-events-none absolute z-10 border border-indigo-400/70 bg-indigo-400/10"
            style={{
              left: selection.selectionRect.x,
              top: selection.selectionRect.y,
              width: selection.selectionRect.width,
              height: selection.selectionRect.height,
            }}
          />
        )}
        {cards.map((card) => (
          <BattlefieldCard
            key={card.id}
            card={card}
            camera={camera}
            cameraAnimating={controls.isAnimating || controls.isPanning}
            zoneWidth={size.width}
            zoneHeight={size.height}
            viewerPlayerId={viewerPlayerId}
            viewerRole={viewerRole}
            mirrorBattlefieldY={isTop}
            isTop={isTop}
            viewScale={camera.scale}
            baseCardHeight={BASE_CARD_HEIGHT}
            baseCardWidth={cardWidth}
            onCardContextMenu={onCardContextMenu}
            playerColors={playerColors}
            renderedZoneId={zone.id}
            zoneOwnerId={zone.ownerId}
            overrideIsDragging={
              selectedCardIds.includes(card.id) ? true : undefined
            }
            disableInteractions={
              controls.isPanning || selectedCardIds.includes(card.id)
            }
          />
        ))}
        <BattlefieldGhostOverlay
          ghostCards={ghosts}
          viewScale={camera.scale}
          baseCardHeight={BASE_CARD_HEIGHT}
          baseCardWidth={cardWidth}
          zoneOwnerId={zone.ownerId}
          playerColors={playerColors}
          selectedCardIds={selectedCardIds}
          isTop={isTop}
        />
      </Zone>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <span className="text-4xl font-bold uppercase tracking-widest">
          {player.name || (isMe ? "Me" : "")}
        </span>
      </div>
      <BattlefieldZoomIndicator
        zoom={controls.zoom}
        limits={controls.zoomLimits}
        reversed={isTop}
        playerName={player.name || "player"}
        disabled={Boolean(disableZoomControls || activeCardId)}
        onChange={controls.setZoom}
      />
    </div>
  );
};
export const Battlefield = React.memo(BattlefieldInner);
