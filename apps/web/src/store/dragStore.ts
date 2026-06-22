import { create } from 'zustand';

import type { PendingDropVisualClaim } from "@/lib/dndVisualOwnership";

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
    setGhostCards: (ghostCards: GhostCardState[] | null) => void;
    setActiveCardId: (activeCardId: string | null) => void;
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
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCards: null,
    activeCardId: null,
    activeCardScale: 1,
    activeCardTransformOrigin: "50% 50%",
    activeCardDragAnchor: null,
    activeCardSourceSize: null,
    pendingDropVisualClaims: [],
    isGroupDragging: false,
    overCardScale: 1,
    setGhostCards: (ghostCards) => set({ ghostCards }),
    setActiveCardId: (activeCardId) => set({ activeCardId }),
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
}));
