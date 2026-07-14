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
import { CommanderZone } from "./CommanderZone";
import { Hand } from "./Hand";
import { PortraitCommanderDrawer } from "./PortraitCommanderDrawer";
import { PortraitSeatToolbar } from "./PortraitSeatToolbar";
import { SideZone } from "./SideZone";
import type { SeatModel } from "@/models/game/seat/seatModel";
import {
  getDesktopHandHeights,
  HAND_CARD_HEIGHT_RATIO,
  HAND_DEFAULT_HEIGHT,
  HAND_MAX_HEIGHT,
  HAND_MIN_HEIGHT,
} from "./handSizing";
import { BASE_CARD_HEIGHT } from "@/lib/constants";
import { useSeatSizing } from "@/hooks/game/seat/useSeatSizing";

const MOBILE_HAND_CARD_BASE_HEIGHT_PX = 120;
const MOBILE_HAND_SCROLLBAR_RESERVED_PX = 14;
const MOBILE_HAND_VERTICAL_PADDING_PX = 6;
const MOBILE_HAND_CARD_HEIGHT_RATIO = 1;
const MOBILE_HAND_CARD_OVERLAP_RATIO = 0.98;

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
  onPortraitCommanderDrawerOpenChange?: (open: boolean) => void;
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
  layoutVariant = "default",
  onPortraitCommanderDrawerOpenChange,
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
      const reservedScrollbarSpace =
        handCards.length > 1 ? MOBILE_HAND_SCROLLBAR_RESERVED_PX : 0;
      const availableCardHeight = Math.max(
        MOBILE_HAND_CARD_BASE_HEIGHT_PX,
        (portraitHandHeight -
          reservedScrollbarSpace -
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
              showContextMenuCursor={player.deckLoaded}
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
              showContextMenuCursor={false}
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
              showContextMenuCursor={false}
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
      getSideZonePreviewProps,
      libraryPreviewCard,
      graveyardPreviewCard,
      exilePreviewCard,
    ],
  );
  const [isCommanderDrawerOpen, setIsCommanderDrawerOpen] = React.useState(false);
  const commanderButtonDrop = useDroppable({
    id: commander ? `mobile-drop:cmdr-btn:${commander.id}` : "mobile-drop:cmdr-btn:none",
    disabled: !commander,
    data: commander
      ? {
          zoneId: commander.id,
          type: commander.type,
        }
      : undefined,
  });
  React.useEffect(() => {
    if (layoutVariant !== "portrait-viewport") return;
    onPortraitCommanderDrawerOpenChange?.(isCommanderDrawerOpen);
  }, [
    isCommanderDrawerOpen,
    layoutVariant,
    onPortraitCommanderDrawerOpenChange,
  ]);

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
            <div className="h-8 shrink-0 px-2 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/70">
              <button
                ref={commanderButtonDrop.setNodeRef}
                type="button"
                className={cn(
                  "h-6 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
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
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600/80 select-none"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.55)" }}
              >
                HAND - {handCards.length}
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
                  cardOverlapRatio={MOBILE_HAND_CARD_OVERLAP_RATIO}
                  baseCardHeight={baseCardHeightPx}
                  showCustomScrollbar
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

        <div
          data-desktop-side-column
          className={cn(
            "absolute z-10 flex w-[var(--seat-side-column-w)] bg-zinc-950/80 backdrop-blur-sm",
            isTop ? "flex-col-reverse" : "flex-col",
            isRight
              ? "right-0 border-l border-white/10"
              : "left-0 border-r border-white/10",
          )}
          style={{
            ...(isTop
              ? { top: effectiveHandHeight, bottom: 0 }
              : { top: 0, bottom: effectiveHandHeight }),
            "--commander-zone-height": `${Math.min(
              168,
              Math.max(104, effectiveHandHeight * 0.85),
            )}px`,
          } as React.CSSProperties & { "--commander-zone-height": string }}
        >
          <div
            data-desktop-side-player-slot
            className={cn(
              "flex min-h-0 flex-1 justify-center overflow-hidden py-3",
              isTop ? "items-end" : "items-start",
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
                  !isRight && "rotate-180",
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
                  !isRight && "rotate-180",
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
              isTop={isTop}
              isRight={isRight}
              onZoneContextMenu={onZoneContextMenu}
              scale={scale}
            />
          )}
        </div>

        <div
          data-desktop-life-total
          className="pointer-events-none absolute right-3 z-40 font-mono text-2xl font-bold leading-none text-zinc-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
          style={{ top: isTop ? effectiveHandHeight + 12 : 12 }}
        >
          {player.life}
        </div>

        <BottomBar
          isTop={isTop}
          isRight={false}
          height={effectiveHandHeight}
          defaultHeight={handDefaultHeightPx}
          minHeight={handMinHeightPx}
          maxHeight={handMaxHeightPx}
          onHeightChange={isMe ? handleHandHeightChange : undefined}
          className={cn(
            "absolute inset-x-0 bg-transparent",
            isTop ? "top-0" : "bottom-0",
          )}
        >
          <div
            data-desktop-bottom-overlay
            className={cn(
              "flex h-full w-full",
              isTop && "rotate-180",
            )}
          >
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
                cardScale={desktopHandCardScale}
                baseCardHeight={baseCardHeightPx}
                fitCards
                labelPlacement="bottom-center"
                cardTopGapPx={0}
                className="!w-1/2 !flex-none !border-0 !bg-transparent !px-2"
              />
            )}

            <div className="grid h-full w-1/2 shrink-0 grid-cols-3">
              {library && (
                <SideZone
                  variant="edge"
                  isTop={isTop}
                  cardHeight={desktopHandHeights?.cardHeight}
                  visibleHeight={effectiveHandHeight}
                  zone={library}
                  card={libraryTopCard}
                  label={ZONE_LABEL.library}
                  count={libraryCount}
                  onContextMenu={onZoneContextMenu}
                  faceDown={libraryFaceDown}
                  disableCardDrag={libraryTopIsPlaceholder}
                  showContextMenuCursor={player.deckLoaded}
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
                            isTop && "rotate-180",
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
                  isTop={isTop}
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
                  showContextMenuCursor={false}
                  {...getSideZonePreviewProps(graveyardPreviewCard)}
                />
              )}

              {exile && (
                <SideZone
                  variant="edge"
                  isTop={isTop}
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
                  showContextMenuCursor={false}
                  {...getSideZonePreviewProps(exilePreviewCard)}
                />
              )}
            </div>
          </div>
        </BottomBar>
      </div>
    </div>
  );
};
