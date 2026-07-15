import { create } from 'zustand';

import type { PendingDropVisualClaim } from "@/lib/dndVisualOwnership";
import type { DragOverlayCue } from "@/lib/dndDragCue";

interface GhostCardState {
    cardId: string;
    zoneId: string;
    position: { x: number; y: number };
    tapped?: boolean;
    size?: { width: number; height: number };
}

interface DragStore {
    ghostCards: GhostCardState[] | null;
    activeCardId: string | null;
    handDragPreview: {
        cardId: string;
        zoneId: string;
        targetIndex: number;
    } | null;
    activeCardScale: number;
    activeCardTransformOrigin: string;
    activeCardDragAnchor: { x: number; y: number } | null;
    activeCardSourceSize: {
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
    } | null;
    pendingDropVisualClaims: PendingDropVisualClaim[];
    isGroupDragging: boolean;
    overCardScale: number;
    dragOverlayScale: number;
    dragOverlayCue: DragOverlayCue | null;
    setGhostCards: (ghostCards: GhostCardState[] | null) => void;
    setActiveCardId: (activeCardId: string | null) => void;
    setHandDragPreview: (
        preview: {
            cardId: string;
            zoneId: string;
            targetIndex: number;
        } | null
    ) => void;
    setActiveCardScale: (scale: number) => void;
    setActiveCardTransformOrigin: (origin: string) => void;
    setActiveCardDragAnchor: (anchor: { x: number; y: number } | null) => void;
    setActiveCardSourceSize: (
        size: {
            width: number;
            height: number;
            offsetX: number;
            offsetY: number;
        } | null
    ) => void;
    setPendingDropVisualClaims: (claims: PendingDropVisualClaim[]) => void;
    clearPendingDropVisualClaims: () => void;
    setIsGroupDragging: (isGroupDragging: boolean) => void;
    setOverCardScale: (scale: number) => void;
    setDragOverlayScale: (scale: number) => void;
    setDragOverlayCue: (cue: DragOverlayCue | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCards: null,
    activeCardId: null,
    handDragPreview: null,
    activeCardScale: 1,
    activeCardTransformOrigin: "50% 50%",
    activeCardDragAnchor: null,
    activeCardSourceSize: null,
    pendingDropVisualClaims: [],
    isGroupDragging: false,
    overCardScale: 1,
    dragOverlayScale: 1,
    dragOverlayCue: null,
    setGhostCards: (ghostCards) => set({ ghostCards }),
    setActiveCardId: (activeCardId) => set({ activeCardId }),
    setHandDragPreview: (handDragPreview) => set({ handDragPreview }),
    setActiveCardScale: (activeCardScale) => set({ activeCardScale }),
    setActiveCardTransformOrigin: (activeCardTransformOrigin) =>
        set({ activeCardTransformOrigin }),
    setActiveCardDragAnchor: (activeCardDragAnchor) =>
        set({ activeCardDragAnchor }),
    setActiveCardSourceSize: (activeCardSourceSize) =>
        set({ activeCardSourceSize }),
    setPendingDropVisualClaims: (pendingDropVisualClaims) =>
        set({ pendingDropVisualClaims }),
    clearPendingDropVisualClaims: () => set({ pendingDropVisualClaims: [] }),
    setIsGroupDragging: (isGroupDragging) => set({ isGroupDragging }),
    setOverCardScale: (overCardScale) => set({ overCardScale }),
    setDragOverlayScale: (dragOverlayScale) => set({ dragOverlayScale }),
    setDragOverlayCue: (dragOverlayCue) => set({ dragOverlayCue }),
}));
