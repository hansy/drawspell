import * as React from "react";

import type { Card } from "@/types";
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from "@/lib/constants";
import { getFlipRotation } from "@/lib/cardDisplay";
import { CardView } from "../card/CardView";

type GhostCardView = {
  card: Card;
  position: { x: number; y: number };
  tapped: boolean;
};

type BattlefieldGhostOverlayProps = {
  ghostCards: GhostCardView[];
  viewScale: number;
  zoneOwnerId: string;
  playerColors: Record<string, string>;
  selectedCardIds: string[];
};

export const BattlefieldGhostOverlay = React.memo(
  ({
    ghostCards,
    viewScale,
    zoneOwnerId,
    playerColors,
    selectedCardIds,
  }: BattlefieldGhostOverlayProps) => {
    if (ghostCards.length === 0) return null;
    const baseWidth = BASE_CARD_HEIGHT * CARD_ASPECT_RATIO;
    const baseHeight = BASE_CARD_HEIGHT;

    return (
      <>
        {ghostCards.map(({ card, position, tapped }) => {
          const transform = tapped
            ? `scale(${viewScale}) rotate(90deg)`
            : `scale(${viewScale})`;
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
              className="pointer-events-none opacity-80 z-10"
              faceDown={card.faceDown}
              imageTransform={
                flipRotation ? `rotate(${flipRotation}deg)` : undefined
              }
              highlightColor={highlightColor}
              isSelected={selectedCardIds.includes(card.id)}
              disableHoverAnimation
            />
          );
        })}
      </>
    );
  }
);

BattlefieldGhostOverlay.displayName = "BattlefieldGhostOverlay";
