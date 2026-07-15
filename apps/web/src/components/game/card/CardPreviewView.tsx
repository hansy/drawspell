import React from "react";
import { Eye, RotateCw, X } from "lucide-react";

import type { Card as CardType } from "@/types";
import { Tooltip } from "@/components/ui/tooltip";
import { CARD_ASPECT_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { CardFace } from "./CardFace";
import { CardPowerToughnessControls } from "./CardPowerToughnessControls";

interface CardPreviewViewProps {
  currentCard: CardType;
  previewCard: CardType;
  locked?: boolean;
  onClose?: () => void;
  style?: React.CSSProperties;
  showControllerRevealIcon: boolean;
  controllerRevealToAll: boolean;
  controllerRevealNames: string[];
  hasMultipleFaces: boolean;
  onFlip: (e: React.MouseEvent) => void;
  flipRotation: number;
  showAncillary: boolean;
  isController: boolean;
  customTextNode?: React.ReactNode;
  showPT: boolean;
  displayPower?: string;
  displayToughness?: string;
  ptBasePower?: string;
  ptBaseToughness?: string;
  onPTDelta: (type: "power" | "toughness", delta: number) => void;
  placement: "top" | "bottom";
}

export const CardPreviewView = React.forwardRef<HTMLDivElement, CardPreviewViewProps>(
  (
    {
      currentCard,
      previewCard,
      locked,
      onClose,
      style,
      showControllerRevealIcon,
      controllerRevealToAll,
      controllerRevealNames,
      hasMultipleFaces,
      onFlip,
      flipRotation,
      showAncillary,
      isController,
      customTextNode,
      showPT,
      displayPower,
      displayToughness,
      ptBasePower,
      ptBaseToughness,
      onPTDelta,
      placement,
    },
    ref
  ) => {
    const showLockedControls = Boolean(locked && onClose);

    return (
      <div
        ref={ref}
        data-card-preview
        data-card-preview-card-id={currentCard.id}
        data-card-preview-locked={String(locked)}
        data-card-preview-placement={placement}
        className={cn(
          "fixed z-[9999] rounded-xl shadow-2xl bg-zinc-900 transition-opacity duration-200 ease-out",
          locked ? "pointer-events-auto" : "pointer-events-none",
          CARD_ASPECT_CLASS,
        )}
        style={style}
        onContextMenu={(e) => e.preventDefault()}
      >
      {showLockedControls && (
        <div
          className="absolute -top-8 -right-8 z-50 flex h-8 items-center justify-end gap-1.5"
          data-card-preview-controls
        >
          {/* Revealed Icon - Only visible to controller */}
          {showControllerRevealIcon && (
            <Tooltip
              placement="left"
              content={
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <div className="font-bold border-b border-zinc-700 pb-1">
                    Revealed to:
                  </div>
                  {controllerRevealToAll ? (
                    <div>Everyone</div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {controllerRevealNames.map((name, idx) => (
                        <div key={`${idx}-${name}`}>{name}</div>
                      ))}
                    </div>
                  )}
                </div>
              }
            >
              <div className="p-0.5 bg-zinc-950/90 hover:bg-zinc-800 rounded-full text-zinc-300 hover:text-white transition-colors border border-zinc-700 shadow-lg cursor-help">
                <Eye size={16} strokeWidth={2} />
              </div>
            </Tooltip>
          )}
          {hasMultipleFaces && (
            <Tooltip content="Preview transform/flip" placement="left">
              <button
                aria-label="Preview transform/flip"
                onClick={onFlip}
                className="p-1.5 bg-zinc-950/90 hover:bg-zinc-800 rounded-full text-zinc-300 hover:text-white transition-colors border border-zinc-700 shadow-lg"
                type="button"
              >
                <RotateCw size={16} strokeWidth={2} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Close preview" placement="left">
            <button
              aria-label="Close preview"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              className="p-1.5 bg-zinc-950/90 hover:bg-zinc-800 rounded-full text-zinc-300 hover:text-white transition-colors border border-zinc-700 shadow-lg"
              type="button"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Token Label */}
      {currentCard.isToken && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-zinc-400 text-xs font-bold px-3 py-1 rounded-full border border-zinc-700 shadow-lg z-40 uppercase tracking-wider">
          Token
        </div>
      )}

      <CardFace
        card={previewCard}
        countersClassName={showAncillary ? "top-4 -right-2" : "hidden"}
        imageClassName="object-cover"
        imageTransform={flipRotation ? `rotate(${flipRotation}deg)` : undefined}
        preferArtCrop={false}
        interactive={showAncillary && locked && isController}
        hidePT={true}
        showCounterLabels={showAncillary}
        revealInteractiveCounterControls={showAncillary && locked && isController}
        hideRevealIcon={true}
        showNameLabel={false}
        customTextPosition="sidebar"
        customTextNode={customTextNode}
      />

      {/* External Power/Toughness (Always rendered, but buttons only accessible when locked) */}
      {showAncillary && showPT && (
        <CardPowerToughnessControls
          displayPower={displayPower}
          displayToughness={displayToughness}
          comparisonPower={ptBasePower ?? currentCard.basePower}
          comparisonToughness={ptBaseToughness ?? currentCard.baseToughness}
          canEdit={Boolean(locked && isController)}
          onDelta={onPTDelta}
        />
      )}
      </div>
    );
  }
);

CardPreviewView.displayName = "CardPreviewView";
