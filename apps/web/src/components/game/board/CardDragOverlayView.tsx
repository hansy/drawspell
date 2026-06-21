import React from "react";

import type { Card as CardType } from "@/types";
import { computeCardContainerStyle } from "@/models/game/card/cardModel";

import { CardView } from "../card/CardView";

const CARD_WIDTH_VAR = "var(--card-w, 80px)";
const CARD_HEIGHT_VAR = "var(--card-h, 120px)";

export const computeDragOverlayFrameStyle = (
  card: CardType
): React.CSSProperties | undefined =>
  card.tapped
    ? {
        position: "relative",
        width: CARD_HEIGHT_VAR,
        height: CARD_WIDTH_VAR,
      }
    : undefined;

export const computeDragOverlayCardStyle = (card: CardType): React.CSSProperties =>
  ({
    ...computeCardContainerStyle({
      tapped: card.tapped,
      rotation: card.rotation,
      isDragging: false,
    }),
    ...(card.tapped
      ? {
          position: "absolute",
          width: CARD_WIDTH_VAR,
          height: CARD_HEIGHT_VAR,
          left: `calc((${CARD_HEIGHT_VAR} - ${CARD_WIDTH_VAR}) / 2)`,
          top: `calc((${CARD_WIDTH_VAR} - ${CARD_HEIGHT_VAR}) / 2)`,
        }
      : {}),
  });

export const CardDragOverlayView: React.FC<{
  card: CardType;
  faceDown: boolean;
  preferArtCrop: boolean;
  "data-dnd-drag-overlay-card-view-id": string;
}> = ({
  card,
  faceDown,
  preferArtCrop,
  "data-dnd-drag-overlay-card-view-id": overlayCardViewId,
}) => {
  const cardView = (
    <CardView
      card={card}
      style={computeDragOverlayCardStyle(card)}
      isDragging
      preferArtCrop={preferArtCrop}
      faceDown={faceDown}
      data-dnd-drag-overlay-card-view-id={overlayCardViewId}
    />
  );

  const frameStyle = computeDragOverlayFrameStyle(card);
  if (!frameStyle) return cardView;

  return (
    <div data-dnd-drag-overlay-card-frame-id={card.id} style={frameStyle}>
      {cardView}
    </div>
  );
};
