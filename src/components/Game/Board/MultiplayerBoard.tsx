import React, { useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { useGameStore } from '../../../store/gameStore';
import { Seat } from '../Seat/Seat';
import { Sidenav } from '../UI/Sidenav';
import { ContextMenu } from '../UI/ContextMenu';
import { LoadDeckModal } from '../UI/LoadDeckModal';
import { useGameDnD } from '../../../hooks/useGameDnD';
import { useGameContextMenu } from '../../../hooks/useGameContextMenu';
import { usePlayerLayout } from '../../../hooks/usePlayerLayout';

export const MultiplayerBoard: React.FC = () => {
    const cards = useGameStore((state) => state.cards);
    const zones = useGameStore((state) => state.zones);
    const { sensors, ghostCard, handleDragMove, handleDragEnd } = useGameDnD();
    const { slots, layoutMode, myPlayerId } = usePlayerLayout();
    const { contextMenu, handleCardContextMenu, handleZoneContextMenu, closeContextMenu } = useGameContextMenu(myPlayerId);
    const hasHydrated = useGameStore((state) => state.hasHydrated);

    const [isLoadDeckModalOpen, setIsLoadDeckModalOpen] = useState(false);

    // Auto-initialize if player is missing (e.g. after reset)
    React.useEffect(() => {
        if (!hasHydrated) return;

        const players = useGameStore.getState().players;
        // We check if the *current* myPlayerId (which should be the persisted one now) exists
        if (!players[myPlayerId]) {
            const { addPlayer, addZone } = useGameStore.getState();

            // Add Player
            addPlayer({
                id: myPlayerId,
                name: 'Me',
                life: 40,
                counters: [],
                commanderDamage: {}
            });

            // Add Zones
            const zoneTypes = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'] as const;
            zoneTypes.forEach(type => {
                addZone({
                    id: `${myPlayerId}-${type}`,
                    type,
                    ownerId: myPlayerId,
                    cardIds: []
                });
            });
        }
    }, [myPlayerId, hasHydrated]);

    const getGridClass = () => {
        switch (layoutMode) {
            case 'single': return 'grid-cols-1 grid-rows-1';
            case 'split': return 'grid-cols-1 grid-rows-2';
            case 'quadrant': return 'grid-cols-2 grid-rows-2';
            default: return 'grid-cols-1 grid-rows-1';
        }
    };

    // Create a map of player ID -> Color for the LifeBox
    const playerColors = React.useMemo(() => {
        const colors: Record<string, string> = {};
        slots.forEach(slot => {
            if (slot.player) {
                colors[slot.player.id] = slot.color;
            }
        });
        return colors;
    }, [slots]);

    return (
        <DndContext sensors={sensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
            <div className="h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden flex font-sans selection:bg-indigo-500/30" onContextMenu={(e) => e.preventDefault()}>
                <Sidenav />

                <div className={`w-full h-full grid ${getGridClass()} pl-12`}>
                    {slots.map((slot, index) => (
                        <div
                            key={index}
                            className="relative border-zinc-800/50"
                        >
                            {slot.player ? (
                                <Seat
                                    player={slot.player}
                                    position={slot.position as any}
                                    color={slot.color as any}
                                    zones={zones}
                                    cards={cards}
                                    isMe={slot.player.id === myPlayerId}
                                    onCardContextMenu={handleCardContextMenu}
                                    onZoneContextMenu={handleZoneContextMenu}
                                    onLoadDeck={() => setIsLoadDeckModalOpen(true)}
                                    ghostCard={ghostCard}
                                    opponentColors={playerColors}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-800 font-bold text-2xl uppercase tracking-widest select-none">
                                    Empty Seat
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={closeContextMenu}
                />
            )}

            <LoadDeckModal
                isOpen={isLoadDeckModalOpen}
                onClose={() => setIsLoadDeckModalOpen(false)}
                playerId={myPlayerId}
            />
        </DndContext>
    );
};
