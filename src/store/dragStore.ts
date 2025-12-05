import { create } from 'zustand';

interface GhostCardState {
    zoneId: string;
    position: { x: number; y: number };
    tapped?: boolean;
}

interface DragStore {
    ghostCard: GhostCardState | null;
    activeCardId: string | null;
    overCardScale: number;
    zoomEdge: 'top' | 'bottom' | 'left' | 'right' | null;
    setGhostCard: (ghostCard: GhostCardState | null) => void;
    setActiveCardId: (activeCardId: string | null) => void;
    setOverCardScale: (scale: number) => void;
    setZoomEdge: (edge: 'top' | 'bottom' | 'left' | 'right' | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCard: null,
    activeCardId: null,
    overCardScale: 1,
    zoomEdge: null,
    setGhostCard: (ghostCard) => set({ ghostCard }),
    setActiveCardId: (activeCardId) => set({ activeCardId }),
    setOverCardScale: (overCardScale) => set({ overCardScale }),
    setZoomEdge: (zoomEdge) => set({ zoomEdge }),
}));
