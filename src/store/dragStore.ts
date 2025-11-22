import { create } from 'zustand';

interface GhostCardState {
    zoneId: string;
    position: { x: number; y: number };
    tapped?: boolean;
}

interface DragStore {
    ghostCard: GhostCardState | null;
    setGhostCard: (ghostCard: GhostCardState | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
    ghostCard: null,
    setGhostCard: (ghostCard) => set({ ghostCard }),
}));
