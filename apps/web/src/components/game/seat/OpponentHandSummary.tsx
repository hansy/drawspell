import React from "react";

import { ZONE } from "@/constants/zones";
import { CARD_ASPECT_RATIO } from "@/lib/constants";
import { shouldRenderFaceDown } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import type { Card as CardType, PlayerId, ViewerRole, Zone as ZoneType } from "@/types";

import { Card } from "../card/Card";
import { useCardPreview } from "../card/CardPreviewProvider";
import { Zone } from "../zone/Zone";

// An opponent's face-down hand only tells you its size, so show the count and
// spend the space on the cards that are actually revealed to this viewer.
export const OpponentHandSummary: React.FC<{
  zone: ZoneType;
  cards: CardType[];
  viewerPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  className?: string;
}> = ({ zone, cards, viewerPlayerId, viewerRole, className }) => {
  const { showPreview, hidePreview } = useCardPreview();
  const revealedCards = React.useMemo(
    () =>
      cards.filter(
        (card) =>
          !shouldRenderFaceDown(card, ZONE.HAND, viewerPlayerId, viewerRole),
      ),
    [cards, viewerPlayerId, viewerRole],
  );

  return (
    <Zone
      zone={zone}
      disabled
      className={cn("flex h-full min-w-0 items-center gap-1.5", className)}
    >
      <div
        data-opponent-hand-count
        aria-label={`Hand: ${cards.length} ${cards.length === 1 ? "card" : "cards"}`}
        className="ds-seat-upright flex h-full shrink-0 flex-col justify-center rounded-md border border-zinc-700/70 bg-zinc-900/80 px-2 leading-none"
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Hand
        </span>
        <span className="mt-0.5 font-mono text-sm font-bold tabular-nums text-zinc-100">
          {cards.length}
        </span>
      </div>
      {revealedCards.length > 0 && (
        <div
          data-opponent-hand-revealed
          aria-label={`${revealedCards.length} revealed ${revealedCards.length === 1 ? "card" : "cards"} in hand`}
          className="flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden scrollbar-none"
        >
          {revealedCards.map((card) => (
            <div
              key={card.id}
              data-opponent-hand-revealed-card={card.id}
              className="relative h-full shrink-0"
              style={{ aspectRatio: `${CARD_ASPECT_RATIO}` }}
              onMouseEnter={(event) => showPreview(card, event.currentTarget)}
              onMouseLeave={() => hidePreview(card.id)}
            >
              <Card
                card={card}
                style={{ width: "100%", height: "100%" }}
                faceDown={false}
                disableDrag
                disableInteractions
                disableHoverAnimation
                className="ds-seat-upright h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </Zone>
  );
};
