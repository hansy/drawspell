import React from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent } from "../../ui/dialog";
import { ContextMenu } from "../context-menu/ContextMenu";

import type { ZoneViewerController } from "@/hooks/game/zone-viewer/useZoneViewerController";
import { getPreviewDimensions } from "@/hooks/game/seat/useSeatSizing";
import { useGameStore } from "@/store/gameStore";
import { ZoneViewerModalHeader } from "./ZoneViewerModalHeader";
import { ZoneViewerGroupedView } from "./ZoneViewerGroupedView";
import { ZoneViewerLinearView } from "./ZoneViewerLinearView";
import { useTwoFingerScroll } from "@/hooks/shared/useTwoFingerScroll";
import { cn } from "@/lib/utils";

export const ZoneViewerModalView: React.FC<ZoneViewerController> = ({
  isOpen,
  onClose,
  zone,
  count,
  isLoading,
  expectedViewCount,
  filterText,
  setFilterText,
  containerRef,
  listRef,
  displayCards,
  viewMode,
  groupedCards,
  sortedKeys,
  canReorder,
  orderedCards,
  orderedCardIds,
  setOrderedCardIds,
  draggingId,
  setDraggingId,
  reorderList,
  commitReorder,
  handleContextMenu,
  contextMenu,
  closeContextMenu,
  interactionsDisabled,
  pinnedCardId,
}) => {
  const baseCardWidthPx = useGameStore((state) =>
    zone ? state.battlefieldGridSizing[zone.ownerId]?.baseCardWidthPx : undefined
  );
  const [isCoarsePointer, setIsCoarsePointer] = React.useState(false);
  const { previewWidthPx, previewHeightPx } = React.useMemo(
    () => getPreviewDimensions(baseCardWidthPx),
    [baseCardWidthPx]
  );
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  const enableLinearCoverFlow = viewMode === "linear" && isCoarsePointer;
  const enableGroupedCoverFlow = viewMode === "grouped" && isCoarsePointer;
  const enableMobileCoverFlow = enableLinearCoverFlow || enableGroupedCoverFlow;
  const [scrollNode, setScrollNode] = React.useState<HTMLDivElement | null>(null);
  useTwoFingerScroll({
    target: scrollNode,
    axis: "x",
    enabled: !enableMobileCoverFlow,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="ds-dialog-size-lg ds-dialog-inset bg-zinc-950 border-zinc-800 text-zinc-100 flex min-h-0 flex-col"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div ref={containerRef} className="relative flex h-full min-h-0 w-full flex-col">
          <div className="px-4 py-3 lg:px-6 lg:py-4 border-b border-zinc-800">
            <ZoneViewerModalHeader
              zoneType={zone.type}
              totalCards={
                isLoading && typeof expectedViewCount === "number"
                  ? expectedViewCount
                  : displayCards.length
              }
              count={count}
              filterText={filterText}
              onFilterTextChange={setFilterText}
            />
          </div>

          <div
            ref={setScrollNode}
            className={cn(
              "flex-1 min-h-0 px-4 pb-4 pt-3 lg:px-6 lg:pb-6 lg:pt-4 bg-zinc-950/50",
              enableGroupedCoverFlow
                ? "overflow-y-auto overflow-x-hidden touch-pan-y"
                : "overflow-x-auto overflow-y-hidden",
              enableLinearCoverFlow ? "touch-pan-x" : !enableGroupedCoverFlow && "touch-none"
            )}
          >
            {displayCards.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-400">
                  {isLoading ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Search size={17} />
                  )}
                </div>
                <div className="text-sm font-medium text-zinc-300">
                  {isLoading ? "Loading cards" : "No cards found"}
                </div>
                <div className="max-w-56 text-xs leading-snug text-zinc-500">
                  {isLoading
                    ? "Fetching the current zone contents."
                    : "Try a different card name, type, or rules text."}
                </div>
              </div>
            ) : viewMode === "grouped" ? (
              <ZoneViewerGroupedView
                sortedKeys={sortedKeys}
                groupedCards={groupedCards}
                cardWidthPx={previewWidthPx}
                cardHeightPx={previewHeightPx}
                interactionsDisabled={interactionsDisabled}
                pinnedCardId={pinnedCardId}
                onCardContextMenu={handleContextMenu}
                mobileCoverFlow={enableGroupedCoverFlow}
              />
            ) : (
              // Linear View
              <ZoneViewerLinearView
                orderedCards={orderedCards}
                canReorder={canReorder}
                orderedCardIds={orderedCardIds}
                setOrderedCardIds={setOrderedCardIds}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                reorderList={reorderList}
                commitReorder={commitReorder}
                displayCards={displayCards}
                interactionsDisabled={interactionsDisabled}
                pinnedCardId={pinnedCardId}
                onCardContextMenu={handleContextMenu}
                listRef={listRef}
                cardWidthPx={previewWidthPx}
                cardHeightPx={previewHeightPx}
                mobileCoverFlow={enableLinearCoverFlow}
              />
            )}
          </div>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={contextMenu.items}
              onClose={closeContextMenu}
              className="z-[100]"
              title={contextMenu.title}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
