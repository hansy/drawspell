import { create } from 'zustand';

interface GhostCardState {
    zoneId: string;
    position: { x: number; y: number };
    tapped?: boolean;
}

interface DragStore {
    ghostCard: GhostCardState | null;
    activeCardId: string | null;
    setGhostCard: (ghostCard: GhostCardState | null) => void;
    setActiveCardId: (activeCardId: string | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCard: null,
    activeCardId: null,
    setGhostCard: (ghostCard) => set({ ghostCard }),
    setActiveCardId: (activeCardId) => set({ activeCardId }),
}));
