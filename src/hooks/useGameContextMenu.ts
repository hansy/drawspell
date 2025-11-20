import React from 'react';
import { useGameStore } from '../store/gameStore';
import { ZoneId } from '../types';

export const useGameContextMenu = (myPlayerId: string) => {
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; items: any[] } | null>(null);
    const zones = useGameStore((state) => state.zones);
    const moveCard = useGameStore((state) => state.moveCard);

    const handleContextMenu = (e: React.MouseEvent, items: any[]) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Helper to find zones
    const findZone = (ownerId: string, type: string) => {
        return Object.values(zones).find(z => z.ownerId === ownerId && z.type === type);
    };

    const handleCardContextMenu = (e: React.MouseEvent, card: any) => {
        const items = [
            { label: 'Tap/Untap', action: () => useGameStore.getState().tapCard(card.id) },
            { label: 'Add +1/+1 Counter', action: () => useGameStore.getState().updateCard(card.id, { counters: [...card.counters, { type: 'p1p1', count: 1 }] }) },
            { label: 'Delete Card', action: () => useGameStore.getState().updateCard(card.id, { zoneId: 'exile' }), danger: true },
        ];

        if (card.zoneId.includes('hand')) {
            items.push(
                {
                    label: 'Play to Battlefield', action: () => {
                        const bf = findZone(myPlayerId, 'battlefield');
                        if (bf) moveCard(card.id, bf.id);
                    }
                },
                {
                    label: 'Discard', action: () => {
                        const gy = findZone(myPlayerId, 'graveyard');
                        if (gy) moveCard(card.id, gy.id);
                    }, danger: true
                }
            );
        }

        handleContextMenu(e, items);
    };

    const handleZoneContextMenu = (e: React.MouseEvent, zoneId: ZoneId) => {
        const zone = zones[zoneId];
        if (zone && zone.type === 'library') {
            handleContextMenu(e, [
                { label: 'Draw Card', action: () => useGameStore.getState().drawCard(myPlayerId) },
                { label: 'Shuffle Library', action: () => useGameStore.getState().shuffleLibrary(myPlayerId) },
            ]);
        }
    };

    return {
        contextMenu,
        handleCardContextMenu,
        handleZoneContextMenu,
        closeContextMenu
    };
};
