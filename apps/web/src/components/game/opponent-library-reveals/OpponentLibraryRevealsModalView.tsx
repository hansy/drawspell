import React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { CardView } from "../card/Card";
import { cn } from "@/lib/utils";
import { getPreviewDimensions } from "@/hooks/game/seat/useSeatSizing";
import { useGameStore } from "@/store/gameStore";
import { useTwoFingerScroll } from "@/hooks/shared/useTwoFingerScroll";

import type { OpponentLibraryRevealsController } from "@/hooks/game/opponent-library-reveals/useOpponentLibraryRevealsController";

export const OpponentLibraryRevealsModalView: React.FC<OpponentLibraryRevealsController> = ({
  isOpen,
  onClose,
  ownerName,
  revealedCards,
  actualTopCardId,
}) => {
  const ownerId = revealedCards[0]?.ownerId;
  const cardLabel = revealedCards.length === 1 ? "card" : "cards";
  const baseCardWidthPx = useGameStore((state) =>
    ownerId ? state.battlefieldGridSizing[ownerId]?.baseCardWidthPx : undefined
  );
  const { previewWidthPx, previewHeightPx } = React.useMemo(
    () => getPreviewDimensions(baseCardWidthPx),
    [baseCardWidthPx]
  );
  const [scrollNode, setScrollNode] = React.useState<HTMLDivElement | null>(null);
  useTwoFingerScroll({ target: scrollNode, axis: "x" });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="ds-dialog-size-lg ds-dialog-inset bg-zinc-950 border-zinc-800 text-zinc-100 flex min-h-0 flex-col">
        <DialogHeader className="px-4 py-3 lg:px-6 lg:py-4 border-b border-zinc-800">
          <DialogTitle className="text-xl capitalize">
            Revealed cards in {ownerName}&apos;s library
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {revealedCards.length} {cardLabel}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={setScrollNode}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pb-4 pt-3 lg:px-6 lg:pb-6 lg:pt-4 touch-none"
        >
          <div className="flex items-center gap-3 h-full">
            {revealedCards.map((card, index) => {
              const isActualTop = Boolean(actualTopCardId && card.id === actualTopCardId);
              return (
                <div key={card.id} className="relative shrink-0">
                  <div
                    className={cn(
                      "relative rounded-lg shadow-lg",
                      isActualTop && "ring-2 ring-indigo-400/70"
                    )}
                    style={{ width: previewWidthPx, height: previewHeightPx }}
                  >
                    <CardView
                      card={card}
                      faceDown={false}
                      style={{ width: previewWidthPx, height: previewHeightPx }}
                      className="w-full h-full"
                    />
                    {index === 0 && (
                      <div className="pointer-events-none absolute left-1/2 top-1.5 z-30 -translate-x-1/2 rounded-full border border-indigo-300/60 bg-indigo-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        {isActualTop ? "Top" : "Topmost revealed"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
