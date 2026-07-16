import * as React from "react";

import type { Card } from "@/types";
import { getCardPixelSize } from "@/lib/positions";
import { getFlipRotation } from "@/lib/cardDisplay";
import { CardView } from "../card/CardView";
import {
  debugLog,
  isDebugEnabled,
  summarizeGhostElement,
  type DebugFlagKey,
} from "@/lib/debug";

type GhostCardView = {
  card: Card;
  position: { x: number; y: number };
  tapped: boolean;
};

type BattlefieldGhostOverlayProps = {
  ghostCards: GhostCardView[];
  viewScale: number;
  baseCardHeight?: number;
  baseCardWidth?: number;
  zoneOwnerId: string;
  playerColors: Record<string, string>;
  selectedCardIds: string[];
  isTop?: boolean;
};

const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

export const BattlefieldGhostOverlay = React.memo(
  ({
    ghostCards,
    viewScale,
    baseCardHeight,
    baseCardWidth,
    zoneOwnerId,
    playerColors,
    selectedCardIds,
    isTop = false,
  }: BattlefieldGhostOverlayProps) => {
    const selectedCardIdSet = React.useMemo(
      () => new Set(selectedCardIds),
      [selectedCardIds],
    );

    React.useEffect(() => {
      if (!isDebugEnabled(BATTLEFIELD_DND_DEBUG_KEY)) return;
      if (typeof requestAnimationFrame === "undefined") return;
      const frame = requestAnimationFrame(() => {
        debugLog(BATTLEFIELD_DND_DEBUG_KEY, "battlefield-ghost-overlay-rendered", {
          viewScale,
          baseCardHeight,
          baseCardWidth,
          ghostCards: ghostCards.map((ghost) => ({
            cardId: ghost.card.id,
            position: ghost.position,
            tapped: ghost.tapped,
            element: summarizeGhostElement(ghost.card.id),
          })),
        });
      });
      return () => cancelAnimationFrame(frame);
    }, [baseCardHeight, baseCardWidth, ghostCards, viewScale]);

    if (ghostCards.length === 0) return null;
    const ghostKind =
      ghostCards.length > 1 ? "battlefield-group" : "battlefield-single";
    const { cardWidth: baseWidth, cardHeight: baseHeight } = getCardPixelSize({
      viewScale: 1,
      isTapped: false,
      baseCardHeight,
      baseCardWidth,
    });

    return (
      <>
        {ghostCards.map(({ card, position, tapped }) => {
          const rotation = card.rotation ? ` rotate(${card.rotation}deg)` : "";
          const tappedRotation = tapped ? " rotate(90deg)" : "";
          const seatRotation = isTop ? " rotate(180deg)" : "";
          const transform = `scale(${viewScale})${seatRotation}${rotation}${tappedRotation}`;
          const highlightColor =
            card.ownerId !== zoneOwnerId ? playerColors[card.ownerId] : undefined;
          const flipRotation = getFlipRotation(card);

          return (
            <CardView
              key={`ghost-${card.id}`}
              card={card}
              style={{
                position: "absolute",
                left: position.x - baseWidth / 2,
                top: position.y - baseHeight / 2,
                transform,
                transformOrigin: "center center",
              }}
              data-dnd-ghost-card-id={card.id}
              data-dnd-ghost-kind={ghostKind}
              className="pointer-events-none opacity-80 z-10"
              faceDown={card.faceDown}
              imageTransform={
                flipRotation ? `rotate(${flipRotation}deg)` : undefined
              }
              highlightColor={highlightColor}
              isSelected={selectedCardIdSet.has(card.id)}
              disableHoverAnimation
            />
          );
        })}
      </>
    );
  }
);

BattlefieldGhostOverlay.displayName = "BattlefieldGhostOverlay";
