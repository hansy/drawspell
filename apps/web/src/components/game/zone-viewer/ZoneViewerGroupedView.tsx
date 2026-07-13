import React from "react";

import type { Card } from "@/types";
import type { LibraryCardGroup, LibraryManaSection } from "@/models/game/zone-viewer/zoneViewerModel";
import { useOptionalCardPreview } from "../card/CardPreviewProvider";
import { ManaCost } from "../mana/ManaCost";
import { cn } from "@/lib/utils";

const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;

type PointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

type TouchGestureState = {
  activePointerIds: Set<number>;
  hadMultiplePointers: boolean;
};

export interface ZoneViewerGroupedViewProps {
  sections: LibraryManaSection[];
  interactionsDisabled: boolean;
  pinnedCardId?: string;
  onCardContextMenu: (event: React.MouseEvent, card: Card) => void;
}

type LibraryCardRowProps = {
  group: LibraryCardGroup;
  touchGesture: React.RefObject<TouchGestureState>;
  interactionsDisabled: boolean;
  isContextMenuOpen: boolean;
  onCardContextMenu: (event: React.MouseEvent, card: Card) => void;
};

const LibraryCardRow: React.FC<LibraryCardRowProps> = ({
  group,
  touchGesture,
  interactionsDisabled,
  isContextMenuOpen,
  onCardContextMenu,
}) => {
  const preview = useOptionalCardPreview();
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointersRef = React.useRef<Map<number, PointerState>>(new Map());
  const longPressTriggeredRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);

  const clearHold = React.useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  React.useEffect(() => clearHold, [clearHold]);

  const openContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      if (interactionsDisabled) return;
      preview?.hidePreview(group.representative.id);
      preview?.unlockPreview();
      onCardContextMenu(event, group.representative);
    }, [group.representative, interactionsDisabled, onCardContextMenu, preview]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || interactionsDisabled || event.button !== 0) return;
    const target = event.currentTarget;
    pointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    });
    longPressTriggeredRef.current = false;
    clearHold();
    if (
      touchGesture.current.hadMultiplePointers ||
      touchGesture.current.activePointerIds.size !== 1
    ) {
      return;
    }
    holdTimerRef.current = setTimeout(() => {
      const pointer = pointersRef.current.get(event.pointerId);
      if (!pointer || pointer.moved || pointer.pointerId !== event.pointerId) return;
      if (
        touchGesture.current.hadMultiplePointers ||
        touchGesture.current.activePointerIds.size !== 1
      ) {
        return;
      }
      longPressTriggeredRef.current = true;
      openContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: pointer.x,
        clientY: pointer.y,
        currentTarget: target,
        target,
      } as unknown as React.MouseEvent);
    }, TOUCH_CONTEXT_MENU_LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointersRef.current.get(event.pointerId);
    if (event.pointerType !== "touch" || !pointer || pointer.pointerId !== event.pointerId) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > TOUCH_MOVE_TOLERANCE_PX) {
      pointer.moved = true;
      clearHold();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointersRef.current.get(event.pointerId);
    if (event.pointerType !== "touch" || !pointer || pointer.pointerId !== event.pointerId) return;
    clearHold();
    pointersRef.current.delete(event.pointerId);
    if (
      !pointer.moved &&
      !longPressTriggeredRef.current &&
      !interactionsDisabled &&
      !touchGesture.current.hadMultiplePointers
    ) {
      preview?.toggleLock(group.representative, event.currentTarget);
    }
    suppressClickRef.current = true;
    longPressTriggeredRef.current = false;
  };

  return (
    <div
      data-zone-viewer-card-id={group.representative.id}
      data-library-card-group={group.key}
      className={cn(
        "library-card-row group relative grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-zinc-800/60 px-2.5 py-2 text-left transition-colors",
        !interactionsDisabled && "cursor-pointer hover:bg-zinc-800/55 active:bg-zinc-800/80",
        isContextMenuOpen && "bg-zinc-800/65"
      )}
      style={{ pointerEvents: interactionsDisabled && !isContextMenuOpen ? "none" : "auto" }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (!interactionsDisabled && event.detail !== 0) {
          preview?.toggleLock(group.representative, event.currentTarget);
        }
      }}
      onContextMenu={openContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={(event) => {
        clearHold();
        pointersRef.current.delete(event.pointerId);
      }}
    >
      <span className="font-mono text-xs tabular-nums text-zinc-500 group-hover:text-zinc-300">
        {group.count}×
      </span>
      <span className="library-card-name min-w-0 text-sm font-medium leading-5 text-zinc-200">
        {group.name}
      </span>
      <ManaCost manaCost={group.manaCost} className="justify-self-end text-[0.95rem]" />
    </div>
  );
};

const LibrarySection: React.FC<{
  section: LibraryManaSection;
  touchGesture: React.RefObject<TouchGestureState>;
  interactionsDisabled: boolean;
  pinnedCardId?: string;
  onCardContextMenu: (event: React.MouseEvent, card: Card) => void;
}> = ({ section, touchGesture, interactionsDisabled, pinnedCardId, onCardContextMenu }) => (
  <section className="library-mana-section min-w-0 rounded-lg border border-zinc-800/80 bg-zinc-950/45">
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2.5 backdrop-blur-sm">
      <h3 className="text-sm font-semibold tracking-wide text-zinc-200">{section.label}</h3>
      <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
        {section.cardCount} {section.cardCount === 1 ? "card" : "cards"} · {section.uniqueCount}{" "}
        unique
      </p>
    </header>
    <div>
      {section.groups.map((group) => (
        <LibraryCardRow
          key={group.key}
          group={group}
          touchGesture={touchGesture}
          interactionsDisabled={interactionsDisabled}
          isContextMenuOpen={group.cards.some((card) => card.id === pinnedCardId)}
          onCardContextMenu={onCardContextMenu}
        />
      ))}
    </div>
  </section>
);

export const ZoneViewerGroupedView: React.FC<ZoneViewerGroupedViewProps> = ({
  sections,
  interactionsDisabled,
  pinnedCardId,
  onCardContextMenu,
}) => {
  const preview = useOptionalCardPreview();
  const hidePreview = preview?.hidePreview;
  const unlockPreview = preview?.unlockPreview;
  const touchGesture = React.useRef<TouchGestureState>({
    activePointerIds: new Set(),
    hadMultiplePointers: false,
  });

  React.useEffect(
    () => () => {
      hidePreview?.();
      unlockPreview?.();
    },
    [hidePreview, unlockPreview]
  );

  const finishTouchPointer = (pointerId: number) => {
    const gesture = touchGesture.current;
    gesture.activePointerIds.delete(pointerId);
    if (gesture.activePointerIds.size === 0) gesture.hadMultiplePointers = false;
  };

  return (
  <div
    className="library-view-container h-full min-h-0"
    onPointerDownCapture={(event) => {
      if (event.pointerType !== "touch") return;
      const gesture = touchGesture.current;
      gesture.activePointerIds.add(event.pointerId);
      if (gesture.activePointerIds.size > 1) gesture.hadMultiplePointers = true;
    }}
    onPointerUp={(event) => {
      if (event.pointerType === "touch") finishTouchPointer(event.pointerId);
    }}
    onPointerCancel={(event) => {
      if (event.pointerType === "touch") finishTouchPointer(event.pointerId);
    }}
  >
    <div className="library-sections h-full min-h-0">
      {sections.map((section) => (
        <LibrarySection
          key={section.key}
          section={section}
          touchGesture={touchGesture}
          interactionsDisabled={interactionsDisabled}
          pinnedCardId={pinnedCardId}
          onCardContextMenu={onCardContextMenu}
        />
      ))}
    </div>
  </div>
  );
};
