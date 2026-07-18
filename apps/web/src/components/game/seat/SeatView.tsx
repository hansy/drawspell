import React from "react";
import { Eye, Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

import { Button } from "../../ui/button";
import { ZONE, ZONE_LABEL } from "@/constants/zones";
import {
  canViewerSeeLibraryCardByReveal,
  canViewerSeeLibraryTopCard,
} from "@/lib/reveal";
import { requestCardPreviewLock } from "@/lib/cardPreviewLock";
import { cn } from "@/lib/utils";
import type { Card as CardType, Player, ViewerRole, ZoneId } from "@/types";
import { useCardPreview } from "@/components/game/card/CardPreviewProvider";
import { useElementSize } from "@/hooks/shared/useElementSize";

import { Battlefield } from "./Battlefield";
import { BottomBar } from "./BottomBar";
import { LifeBox } from "../player/LifeBox";
import { CommanderZone } from "./CommanderZone";
import { Hand } from "./Hand";
import { PortraitCommanderDrawer } from "./PortraitCommanderDrawer";
import { PortraitSeatToolbar } from "./PortraitSeatToolbar";
import { SideZone } from "./SideZone";
import { SeatOrientationFrame } from "./SeatOrientationFrame";
import type { SeatModel } from "@/models/game/seat/seatModel";
import {
  getDesktopHandHeights,
  HAND_CARD_HEIGHT_RATIO,
  HAND_DEFAULT_HEIGHT,
  HAND_MAX_HEIGHT,
  HAND_MIN_HEIGHT,
  getCommanderDrawerHeight,
  getCommanderZoneLabelSizing,
} from "./handSizing";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import { useSeatSizing } from "@/hooks/game/seat/useSeatSizing";
import { ZONE_DRAG_OVERLAY_SCALE } from "@/lib/dndDragCue";

const MOBILE_HAND_CARD_BASE_HEIGHT_PX = 120;
const MOBILE_HAND_VERTICAL_PADDING_PX = 18;
const MOBILE_HAND_CARD_HEIGHT_RATIO = 0.94;

interface SeatViewProps {
  player: Player;
  color: string;
  isMe: boolean;
  viewerPlayerId: string;
  viewerRole?: ViewerRole;
  scale?: number;
  className?: string;
  opponentColors: Record<string, string>;
  battlefieldScale?: number;
  model: SeatModel;
  onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
  onHandContextMenu?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  onZoneContextMenu?: (e: React.MouseEvent, zoneId: ZoneId) => void;
  onBattlefieldContextMenu?: (e: React.MouseEvent) => void;
  onLoadDeck?: () => void;
  onEditUsername?: () => void;
  onViewZone?: (zoneId: ZoneId, count?: number) => void;
  onDrawCard?: (playerId: string) => void;
  onOpponentLibraryReveals?: (zoneId: ZoneId) => void;
  zoomControlsDisabled?: boolean;
  onLifeContextMenu?: (e: React.MouseEvent, player: Player) => void;
  layoutVariant?: "default" | "portrait-viewport";
  portraitSeatSwitcher?: React.ReactNode;
}

export const SeatView: React.FC<SeatViewProps> = ({
  player,
  color,
  isMe,
  viewerPlayerId,
  viewerRole,
  scale = 1,
  className,
  onCardContextMenu,
  onHandContextMenu,
  onZoneContextMenu,
  onBattlefieldContextMenu,
  onLoadDeck,
  onEditUsername,
  opponentColors,
  onViewZone,
  onDrawCard,
  battlefieldScale = 1,
  onOpponentLibraryReveals,
  model,
  zoomControlsDisabled,
  onLifeContextMenu,
  layoutVariant = "default",
  portraitSeatSwitcher,
}) => {
  const { showPreview, hidePreview } = useCardPreview();
  const [handHeight, setHandHeight] = React.useState(HAND_DEFAULT_HEIGHT);
  const [hasHandOverride, setHasHandOverride] = React.useState(false);
  const {
    ref: seatRef,
    cssVars,
    sizing,
    isLg,
  } = useSeatSizing();
  const clamp = React.useCallback(
    (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value)),
    [],
  );
  const desktopHandHeights = React.useMemo(
    () =>
      isLg && sizing
        ? getDesktopHandHeights({
            seatWidth: sizing.seatWidthPx,
            seatHeight: sizing.seatHeightPx,
          })
        : null,
    [isLg, sizing],
  );
  const handMinHeightPx = desktopHandHeights?.minHeight ?? HAND_MIN_HEIGHT;
  const handMaxHeightPx = desktopHandHeights?.maxHeight ?? HAND_MAX_HEIGHT;
  const handDefaultHeightPx =
    desktopHandHeights?.defaultHeight ?? HAND_DEFAULT_HEIGHT;
  const effectiveHandHeight = desktopHandHeights
    ? hasHandOverride
      ? clamp(handHeight, handMinHeightPx, handMaxHeightPx)
      : handDefaultHeightPx
    : handHeight;
  const { ref: portraitHandRef, size: portraitHandSize } =
    useElementSize<HTMLDivElement>();
  const portraitHandHeight = portraitHandSize.height;
  const baseCardHeightPx = sizing?.baseCardHeightPx;
  const baseCardWidthPx = sizing?.baseCardWidthPx;
  const handleHandHeightChange = React.useCallback((height: number) => {
    setHasHandOverride(true);
    setHandHeight(height);
  }, []);

  const {
    isTop,
    isRight,
    mirrorBattlefieldY,
    inverseScalePercent,
    opponentLibraryRevealCount,
  } = model;
  const showLoadDeckAction = Boolean(isMe && onLoadDeck && !player.deckLoaded);
  const showPublicZoneContextMenuCursor = Boolean(
    onZoneContextMenu && viewerRole !== "spectator" && player.deckLoaded,
  );
  const showLibraryContextMenuCursor = Boolean(
    showPublicZoneContextMenuCursor && isMe,
  );
  const { hand, library, graveyard, exile, battlefield, commander } =
    model.zones;
  const {
    library: libraryCards,
    graveyard: graveyardCards,
    exile: exileCards,
  } = model.cards;
  const {
    battlefield: battlefieldCards,
    commander: commandCards,
    hand: handCards,
  } = model.cards;
  const handCardScale = React.useMemo(() => {
    if (layoutVariant === "portrait-viewport" && portraitHandHeight > 0) {
      const availableCardHeight = Math.max(
        MOBILE_HAND_CARD_BASE_HEIGHT_PX,
        (portraitHandHeight -
          MOBILE_HAND_VERTICAL_PADDING_PX) *
          MOBILE_HAND_CARD_HEIGHT_RATIO,
      );
      return availableCardHeight / MOBILE_HAND_CARD_BASE_HEIGHT_PX;
    }

    const resolvedBaseHeight = baseCardHeightPx ?? BASE_CARD_HEIGHT;
    if (!resolvedBaseHeight) return 1;
    return (effectiveHandHeight * HAND_CARD_HEIGHT_RATIO) / resolvedBaseHeight;
  }, [
    baseCardHeightPx,
    effectiveHandHeight,
    handCards.length,
    layoutVariant,
    portraitHandHeight,
  ]);
  const desktopHandCardScale = React.useMemo(() => {
    if (!desktopHandHeights) return handCardScale;
    const resolvedBaseHeight = baseCardHeightPx ?? BASE_CARD_HEIGHT;
    if (!resolvedBaseHeight) return 1;
    return desktopHandHeights.cardHeight / resolvedBaseHeight;
  }, [baseCardHeightPx, desktopHandHeights, handCardScale]);
  const desktopBottomZoneWidth =
    (desktopHandHeights?.cardHeight ??
      (baseCardHeightPx ?? BASE_CARD_HEIGHT) * desktopHandCardScale) *
    CARD_ASPECT_RATIO;
  const commanderDrawerHeight = getCommanderDrawerHeight({
    battlefieldCardHeight: baseCardHeightPx,
    handHeight: effectiveHandHeight,
  });
  const commanderZoneLabelSizing = getCommanderZoneLabelSizing(scale);
  const libraryCount = player.libraryCount ?? library?.cardIds.length ?? 0;
  const libraryPlaceholder = React.useMemo(
    () =>
      library
        ? ({
            id: `placeholder:library:${library.ownerId}`,
            name: "Card",
            ownerId: library.ownerId,
            controllerId: library.ownerId,
            zoneId: library.id,
            tapped: false,
            faceDown: false,
            position: { x: 0.5, y: 0.5 },
            rotation: 0,
            counters: [],
          } as CardType)
        : null,
    [library],
  );
  const libraryTopCard =
    libraryCards.length > 0
      ? libraryCards[libraryCards.length - 1]
      : libraryCount > 0
        ? (libraryPlaceholder ?? undefined)
        : undefined;
  const libraryTopIsPlaceholder = Boolean(
    libraryTopCard?.id && libraryTopCard.id.startsWith("placeholder:library:"),
  );
  const canSeeLibraryTop =
    libraryCards.length > 0 && libraryTopCard
      ? canViewerSeeLibraryCardByReveal(
          libraryTopCard,
          viewerPlayerId,
          viewerRole,
        ) ||
        canViewerSeeLibraryTopCard({
          viewerId: viewerPlayerId,
          ownerId: library?.ownerId ?? player.id,
          viewerRole,
          mode: player.libraryTopReveal,
        })
      : false;
  const libraryFaceDown = libraryTopCard ? !canSeeLibraryTop : true;
  const graveyardTopCard = graveyardCards[graveyardCards.length - 1];
  const exileTopCard = exileCards[exileCards.length - 1];
  const libraryPreviewCard =
    isLg && libraryTopCard && !libraryFaceDown && !libraryTopIsPlaceholder
      ? libraryTopCard
      : undefined;
  const graveyardPreviewCard =
    isLg && graveyardTopCard && !graveyardTopCard.faceDown
      ? graveyardTopCard
      : undefined;
  const exilePreviewCard =
    isLg && exileTopCard && !exileTopCard.faceDown ? exileTopCard : undefined;
  const sideZonePreviewCardIdsRef = React.useRef<{
    library?: string;
    graveyard?: string;
    exile?: string;
  }>({});
  const getSideZonePreviewProps = React.useCallback(
    (previewCard?: CardType) => {
      if (!previewCard) return {};
      return {
        onMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => {
          event.currentTarget.dataset.previewCardId = previewCard.id;
          showPreview(previewCard, event.currentTarget);
        },
        onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => {
          const previewCardId = event.currentTarget.dataset.previewCardId;
          delete event.currentTarget.dataset.previewCardId;
          hidePreview(previewCardId || undefined);
        },
      };
    },
    [hidePreview, showPreview],
  );
  React.useEffect(() => {
    const previousPreviewCardIds = sideZonePreviewCardIdsRef.current;
    const nextPreviewCardIds = {
      library: libraryPreviewCard?.id,
      graveyard: graveyardPreviewCard?.id,
      exile: exilePreviewCard?.id,
    };
    (Object.keys(previousPreviewCardIds) as Array<keyof typeof nextPreviewCardIds>).forEach(
      (zoneKey) => {
        const previousCardId = previousPreviewCardIds[zoneKey];
        const nextCardId = nextPreviewCardIds[zoneKey];
        if (previousCardId && previousCardId !== nextCardId) {
          hidePreview(previousCardId);
        }
      },
    );
    sideZonePreviewCardIdsRef.current = nextPreviewCardIds;
  }, [
    exilePreviewCard?.id,
    graveyardPreviewCard?.id,
    hidePreview,
    libraryPreviewCard?.id,
  ]);
  const mobileZoneStripStyle = React.useMemo(
    () =>
      ({
        "--sidezone-h": "100%",
        "--sidezone-aspect": "1.5",
        "--sidezone-card-scale": "1.5",
      }) as React.CSSProperties,
    [],
  );
  const mobileZoneStrip = React.useMemo(
    () => (
      <div
        className="grid h-full grid-cols-3 gap-2"
        style={mobileZoneStripStyle}
        data-no-seat-swipe="true"
      >
        <div className="aspect-[3/2] min-w-0">
          {library ? (
            <SideZone
              zone={library}
              card={libraryTopCard}
              label={ZONE_LABEL.library}
              count={libraryCount}
              onContextMenu={onZoneContextMenu}
              faceDown={libraryFaceDown}
              disableCardDrag={libraryTopIsPlaceholder}
              showContextMenuCursor={showLibraryContextMenuCursor}
              indicatorSide={isRight ? "left" : "right"}
              onClick={
                isMe
                  ? (e) => {
                      if (!libraryTopCard || libraryFaceDown || libraryTopIsPlaceholder) {
                        return;
                      }
                      requestCardPreviewLock({
                        cardId: libraryTopCard.id,
                        anchorEl: e.currentTarget as HTMLElement,
                      });
                    }
                  : opponentLibraryRevealCount > 0 && onOpponentLibraryReveals
                    ? (e) => {
                        e.preventDefault();
                        onOpponentLibraryReveals(library.id);
                      }
                    : onViewZone
                      ? () => onViewZone(library.id)
                      : undefined
              }
              rightIndicator={
                !isMe && opponentLibraryRevealCount > 0 ? (
                  <div className="w-9 h-9 rounded-full bg-zinc-950/95 border border-zinc-700 flex items-center justify-center shadow-lg">
                    <Eye size={20} className="text-white" />
                  </div>
                ) : undefined
              }
              {...getSideZonePreviewProps(libraryPreviewCard)}
              onDoubleClick={
                isMe && onDrawCard
                  ? (e) => {
                      e.preventDefault();
                      onDrawCard(player.id);
                    }
                  : undefined
              }
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
        <div className="aspect-[3/2] min-w-0">
          {graveyard ? (
            <SideZone
              zone={graveyard}
              card={graveyardCards[graveyardCards.length - 1]}
              label={ZONE_LABEL.graveyard}
              count={graveyard.cardIds.length}
              onContextMenu={onZoneContextMenu}
              onClick={
                onViewZone && graveyard.type === ZONE.GRAVEYARD
                  ? (_e) => onViewZone(graveyard.id)
                  : undefined
              }
              faceDown={graveyardCards[graveyardCards.length - 1]?.faceDown}
              showContextMenuCursor={showPublicZoneContextMenuCursor}
              {...getSideZonePreviewProps(graveyardPreviewCard)}
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
        <div className="aspect-[3/2] min-w-0">
          {exile ? (
            <SideZone
              zone={exile}
              card={exileCards[exileCards.length - 1]}
              label={ZONE_LABEL.exile}
              count={exile.cardIds.length}
              onContextMenu={onZoneContextMenu}
              onClick={
                onViewZone && exile.type === ZONE.EXILE
                  ? (_e) => onViewZone(exile.id)
                  : undefined
              }
              cardClassName="opacity-60 grayscale"
              faceDown={exileCards[exileCards.length - 1]?.faceDown}
              showContextMenuCursor={showPublicZoneContextMenuCursor}
              {...getSideZonePreviewProps(exilePreviewCard)}
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
      </div>
    ),
    [
      exile,
      exileCards,
      graveyard,
      graveyardCards,
      isMe,
      isRight,
      library,
      libraryCount,
      libraryFaceDown,
      libraryTopCard,
      libraryTopIsPlaceholder,
      mobileZoneStripStyle,
      onDrawCard,
      onOpponentLibraryReveals,
      onViewZone,
      onZoneContextMenu,
      opponentLibraryRevealCount,
      player.deckLoaded,
      player.id,
      showLibraryContextMenuCursor,
      showPublicZoneContextMenuCursor,
      getSideZonePreviewProps,
      libraryPreviewCard,
      graveyardPreviewCard,
      exilePreviewCard,
    ],
  );
  const [isCommanderDrawerOpen, setIsCommanderDrawerOpen] = React.useState(false);
  React.useEffect(() => {
    setIsCommanderDrawerOpen(false);
  }, [player.id]);
  const commanderButtonDrop = useDroppable({
    id: commander ? `mobile-drop:cmdr-btn:${commander.id}` : "mobile-drop:cmdr-btn:none",
    disabled: !commander,
    data: commander
      ? {
          zoneId: commander.id,
          type: commander.type,
          dragOverlayScale: ZONE_DRAG_OVERLAY_SCALE,
          dragOverlayCue: "zone",
        }
      : undefined,
  });
  if (layoutVariant === "portrait-viewport") {
    return (
      <div
        ref={seatRef}
        className={cn("relative w-full h-full", className)}
        style={cssVars}
      >
        <div className="flex h-full w-full flex-col">
          <div className="relative h-1/2 min-h-0 shrink-0 border-b border-white/5 flex">
            {battlefield && (
              <Battlefield
                zone={battlefield}
                cards={battlefieldCards}
                player={player}
                isTop={isTop}
                isMe={isMe}
                viewerPlayerId={viewerPlayerId}
                viewerRole={viewerRole}
                mirrorBattlefieldY={mirrorBattlefieldY}
                scale={scale}
                viewScale={battlefieldScale}
                baseCardHeight={baseCardHeightPx}
                baseCardWidth={baseCardWidthPx}
                onCardContextMenu={onCardContextMenu}
                onContextMenu={isMe ? onBattlefieldContextMenu : undefined}
                showContextMenuCursor={Boolean(player.deckLoaded && isMe)}
                playerColors={{ [player.id]: color, ...opponentColors }}
                disableZoomControls={zoomControlsDisabled}
              />
            )}
          </div>
          <PortraitSeatToolbar
            player={player}
            isMe={isMe}
            opponentColors={opponentColors}
            zoneStrip={mobileZoneStrip}
            onLoadDeck={onLoadDeck}
            showLoadLibraryAction={showLoadDeckAction}
          />
          <div className="relative min-h-0 flex-1 flex flex-col bg-zinc-900/55 backdrop-blur-sm border-t border-white/10 overflow-hidden">
            <div className="grid h-11 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-zinc-800/70 bg-zinc-900/70 px-2">
              <button
                ref={commanderButtonDrop.setNodeRef}
                type="button"
                className={cn(
                  "h-full rounded-md px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  isCommanderDrawerOpen && "border-indigo-400/70 bg-indigo-500/15 text-indigo-100",
                  commanderButtonDrop.isOver && "ring-2 ring-indigo-400/80 bg-indigo-500/20",
                )}
                onClick={() => {
                  if (!commander) return;
                  setIsCommanderDrawerOpen((prev) => !prev);
                }}
                disabled={!commander}
                data-no-seat-swipe="true"
                aria-label="Toggle commander drawer"
              >
                CMDR
              </button>
              <div className="h-full min-w-0">{portraitSeatSwitcher}</div>
              <span
                className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 select-none"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.55)" }}
              >
                HAND · {handCards.length}
              </span>
            </div>
            <div ref={portraitHandRef} className="min-h-0 flex-1 flex">
              {hand && (
                <Hand
                  zone={hand}
                  cards={handCards}
                  isTop={isTop}
                  isRight={isRight}
                  isMe={isMe}
                  viewerPlayerId={viewerPlayerId}
                  viewerRole={viewerRole}
                  onCardContextMenu={onCardContextMenu}
                  onHandContextMenu={onHandContextMenu}
                  scale={scale}
                  cardScale={handCardScale}
                  cardOverlapRatio={1}
                  baseCardHeight={baseCardHeightPx}
                  scrollAlignment="start"
                  showLabel={false}
                  dropDisabled={isCommanderDrawerOpen}
                  className="!w-full !flex-none !border-0 !bg-transparent"
                />
              )}
            </div>
            <PortraitCommanderDrawer
              open={isCommanderDrawerOpen}
              zone={commander}
              cards={commandCards}
              onZoneContextMenu={onZoneContextMenu}
              onCardContextMenu={onCardContextMenu}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={seatRef}
      data-seat-edge={isTop ? "top" : "bottom"}
      className={cn(
        "ds-desktop-seat-container relative w-full h-full",
        className,
      )}
      style={cssVars}
    >
      <div
        data-desktop-seat-overlay
        className="relative h-full w-full"
        style={{
          width: `${inverseScalePercent}%`,
          height: `${inverseScalePercent}%`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className={cn(
            "absolute inset-0 pointer-events-none",
            // Base border
            "border",
            // Inset Glow
            "shadow-[inset_0_0_20px_var(--tw-shadow-color)]",

            // Color variants
            color === "rose" && "border-rose-900/20 shadow-rose-400/90",
            color === "violet" && "border-violet-900/20 shadow-violet-400/90",
            color === "sky" && "border-sky-900/20 shadow-sky-400/90",
            color === "amber" && "border-amber-900/20 shadow-amber-400/90",
          )}
        />

        <div className="absolute inset-0 flex min-h-0 min-w-0">
          {battlefield && (
            <Battlefield
              zone={battlefield}
              cards={battlefieldCards}
              player={player}
              isTop={isTop}
              isMe={isMe}
              viewerPlayerId={viewerPlayerId}
              viewerRole={viewerRole}
              mirrorBattlefieldY={mirrorBattlefieldY}
              scale={scale}
              viewScale={battlefieldScale}
              baseCardHeight={baseCardHeightPx}
              baseCardWidth={baseCardWidthPx}
              onCardContextMenu={onCardContextMenu}
              onContextMenu={isMe ? onBattlefieldContextMenu : undefined}
              showContextMenuCursor={Boolean(player.deckLoaded && isMe)}
              playerColors={{ [player.id]: color, ...opponentColors }}
              disableZoomControls={zoomControlsDisabled}
            />
          )}
        </div>

        <SeatOrientationFrame isTop={isTop} isRight={isRight}>
        <div
          data-desktop-side-column
          className={cn(
            "pointer-events-auto absolute z-10 flex w-[var(--seat-side-column-w)]",
            "left-0 flex-col border-r border-white/10",
          )}
          style={{
            top: 0,
            bottom: effectiveHandHeight,
            "--commander-zone-label-height": `${commanderZoneLabelSizing.height}px`,
            "--commander-zone-label-padding": `${commanderZoneLabelSizing.padding}px`,
            "--commander-drawer-height": `${commanderDrawerHeight}px`,
          } as React.CSSProperties & {
            "--commander-zone-label-height": string;
            "--commander-zone-label-padding": string;
            "--commander-drawer-height": string;
          }}
        >
          <LifeBox
            player={player}
            color={color}
            isMe={isMe}
            opponentColors={opponentColors}
            variant="sidebar"
            isTop={isTop}
            isRight={isRight}
            onContextMenu={
              onLifeContextMenu
                ? (event) => onLifeContextMenu(event, player)
                : undefined
            }
          />

          <div
            data-desktop-side-player-slot
            className={cn(
              "flex min-h-0 flex-1 justify-center overflow-hidden bg-zinc-950/80 py-3 backdrop-blur-sm",
              "items-start",
            )}
          >
            {isMe && onEditUsername ? (
              <button
                type="button"
                data-desktop-side-player-name
                aria-label="Edit player name"
                onClick={onEditUsername}
                className={cn(
                  "max-h-full cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] transition-colors [writing-mode:vertical-rl] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                  "ds-seat-upright ds-seat-vertical-label",
                  color === "rose" && "text-rose-400",
                  color === "violet" && "text-violet-400",
                  color === "sky" && "text-sky-400",
                  color === "amber" && "text-amber-400",
                )}
              >
                {player.name || "Me"}
              </button>
            ) : (
              <span
                data-desktop-side-player-name
                className={cn(
                  "max-h-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] [writing-mode:vertical-rl]",
                  "ds-seat-upright ds-seat-vertical-label",
                  color === "rose" && "text-rose-400",
                  color === "violet" && "text-violet-400",
                  color === "sky" && "text-sky-400",
                  color === "amber" && "text-amber-400",
                )}
              >
                {player.name || (isMe ? "Me" : "")}
              </span>
            )}
          </div>

          {commander && (
            <CommanderZone
              zone={commander}
              cards={commandCards}
              isTop={false}
              isRight={false}
              onZoneContextMenu={onZoneContextMenu}
              scale={scale}
              color={color}
            />
          )}
        </div>

        <BottomBar
          isTop={false}
          isRight={false}
          invertResizeDirection={isTop}
          height={effectiveHandHeight}
          defaultHeight={handDefaultHeightPx}
          minHeight={handMinHeightPx}
          maxHeight={handMaxHeightPx}
          onHeightChange={isMe ? handleHandHeightChange : undefined}
          dropBlockerId={`bottom-bar-drop-blocker:${player.id}`}
          className={cn(
            "pointer-events-auto absolute inset-x-0 bg-transparent",
            "bottom-0",
          )}
        >
          <div
            data-desktop-bottom-overlay
            className={cn(
              "flex h-full w-full",
            )}
          >
            {hand && (
              <Hand
                zone={hand}
                cards={handCards}
                isTop={false}
                isRight={false}
                isMe={isMe}
                viewerPlayerId={viewerPlayerId}
                viewerRole={viewerRole}
                onCardContextMenu={onCardContextMenu}
                onHandContextMenu={onHandContextMenu}
                scale={scale}
                cardScale={desktopHandCardScale}
                baseCardHeight={baseCardHeightPx}
                fitCards
                flipCards={isTop}
                labelPlacement="bottom-center"
                cardTopGapPx={0}
                className="!w-auto !flex-1 !border-0 !bg-transparent !px-2"
              />
            )}

            <div
              data-desktop-bottom-zone-cluster
              className="ml-auto grid h-full shrink-0 grid-cols-3 gap-[var(--desktop-bottom-zone-gap)] pr-[var(--seat-rail-edge-inset)]"
              style={{
                gridTemplateColumns: `repeat(3, ${desktopBottomZoneWidth}px)`,
              }}
            >
              {library && (
                <SideZone
                  variant="edge"
                  flipCard={isTop}
                  cardHeight={desktopHandHeights?.cardHeight}
                  visibleHeight={effectiveHandHeight}
                  zone={library}
                  card={libraryTopCard}
                  label={ZONE_LABEL.library}
                  count={libraryCount}
                  onContextMenu={onZoneContextMenu}
                  faceDown={libraryFaceDown}
                  disableCardDrag={libraryTopIsPlaceholder}
                  showContextMenuCursor={showLibraryContextMenuCursor}
                  onClick={
                    !isMe &&
                    opponentLibraryRevealCount > 0 &&
                    onOpponentLibraryReveals
                      ? (e) => {
                          e.preventDefault();
                          onOpponentLibraryReveals(library.id);
                        }
                      : undefined
                  }
                  rightIndicator={
                    !isMe && opponentLibraryRevealCount > 0 ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/95 shadow-lg">
                        <Eye size={18} className="text-white" />
                      </div>
                    ) : undefined
                  }
                  {...getSideZonePreviewProps(libraryPreviewCard)}
                  onDoubleClick={
                    isMe && onDrawCard
                      ? (e) => {
                          e.preventDefault();
                          onDrawCard(player.id);
                        }
                      : undefined
                  }
                  emptyContent={
                    showLoadDeckAction ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLoadDeck}
                        className="relative h-full w-full border border-indigo-500/30 bg-indigo-600/20 text-zinc-300 hover:bg-indigo-600/40 hover:text-white"
                      >
                        <span
                          data-load-deck-label
                          className={cn(
                            "absolute left-1/2 top-1/4 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1",
                            "ds-seat-upright",
                          )}
                        >
                          <Plus size={18} />
                          <span className="whitespace-nowrap text-[10px] font-medium">
                            Load Deck
                          </span>
                        </span>
                      </Button>
                    ) : undefined
                  }
                />
              )}

              {graveyard && (
                <SideZone
                  variant="edge"
                  flipCard={isTop}
                  cardHeight={desktopHandHeights?.cardHeight}
                  visibleHeight={effectiveHandHeight}
                  zone={graveyard}
                  card={graveyardTopCard}
                  label={ZONE_LABEL.graveyard}
                  count={graveyard.cardIds.length}
                  onContextMenu={onZoneContextMenu}
                  onClick={
                    onViewZone && graveyard.type === ZONE.GRAVEYARD
                      ? (_e) => onViewZone(graveyard.id)
                      : undefined
                  }
                  faceDown={graveyardTopCard?.faceDown}
                  showContextMenuCursor={showPublicZoneContextMenuCursor}
                  {...getSideZonePreviewProps(graveyardPreviewCard)}
                />
              )}

              {exile && (
                <SideZone
                  variant="edge"
                  flipCard={isTop}
                  cardHeight={desktopHandHeights?.cardHeight}
                  visibleHeight={effectiveHandHeight}
                  zone={exile}
                  card={exileTopCard}
                  label={ZONE_LABEL.exile}
                  count={exile.cardIds.length}
                  onContextMenu={onZoneContextMenu}
                  onClick={
                    onViewZone && exile.type === ZONE.EXILE
                      ? (_e) => onViewZone(exile.id)
                      : undefined
                  }
                  cardClassName="opacity-60 grayscale"
                  faceDown={exileTopCard?.faceDown}
                  showContextMenuCursor={showPublicZoneContextMenuCursor}
                  {...getSideZonePreviewProps(exilePreviewCard)}
                />
              )}
            </div>
          </div>
        </BottomBar>
        </SeatOrientationFrame>
      </div>
    </div>
  );
};
