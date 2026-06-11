import { create } from 'zustand';

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
    isGroupDragging: boolean;
    overCardScale: number;
    setGhostCards: (ghostCards: GhostCardState[] | null) => void;
    setActiveCardId: (activeCardId: string | null) => void;
    setActiveCardScale: (scale: number) => void;
    setActiveCardTransformOrigin: (origin: string) => void;
    setIsGroupDragging: (isGroupDragging: boolean) => void;
    setOverCardScale: (scale: number) => void;
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCards: null,
    activeCardId: null,
    activeCardScale: 1,
    activeCardTransformOrigin: "50% 50%",
    isGroupDragging: false,
    overCardScale: 1,
    setGhostCards: (ghostCards) => set({ ghostCards }),
    setActiveCardId: (activeCardId) => set({ activeCardId }),
    setActiveCardScale: (activeCardScale) => set({ activeCardScale }),
    setActiveCardTransformOrigin: (activeCardTransformOrigin) =>
        set({ activeCardTransformOrigin }),
    setIsGroupDragging: (isGroupDragging) => set({ isGroupDragging }),
    setOverCardScale: (overCardScale) => set({ overCardScale }),
}));
