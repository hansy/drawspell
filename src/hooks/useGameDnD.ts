import React from 'react';
import {
    useSensor,
    useSensors,
    PointerSensor,
    DragEndEvent,
    DragMoveEvent,
    DragStartEvent
} from '@dnd-kit/core';
import { useGameStore } from '../store/gameStore';
import { useDragStore } from '../store/dragStore';
import { ZoneId, CardId } from '../types';
import {
    getEventCoordinates,
    calculatePointerOffset,
    calculateRelativePosition,
    canDropToZone,
    DragPosition,
    DragOffset
} from '../lib/dnd';

export const useGameDnD = () => {
    const cards = useGameStore((state) => state.cards);
    const zones = useGameStore((state) => state.zones);
    const moveCard = useGameStore((state) => state.moveCard);
    const setGhostCard = useDragStore((state) => state.setGhostCard);
    const setActiveCardId = useDragStore((state) => state.setActiveCardId);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Track pointer start and offset to card center so positioning follows the cursor.
    const dragPointerStart = React.useRef<DragPosition | null>(null);
    const dragPointerToCenter = React.useRef<DragOffset>({ x: 0, y: 0 });

    const handleDragStart = (event: DragStartEvent) => {
        setGhostCard(null);
        if (event.active.data.current?.cardId) {
            setActiveCardId(event.active.data.current.cardId);
        }

        const { active } = event;
        // @ts-ignore - rect is available on active
        const activeRect = active.rect.current?.initial || active.rect.current?.translated;

        const pointer = getEventCoordinates(event);

        // Fallback to card center if we couldn't read the pointer (keeps the ghost anchored).
        const center = activeRect
            ? { x: activeRect.left + activeRect.width / 2, y: activeRect.top + activeRect.height / 2 }
            : null;

        dragPointerStart.current = pointer || center;

        if (center && pointer && activeRect) {
            dragPointerToCenter.current = calculatePointerOffset(pointer, activeRect);
        } else {
            dragPointerToCenter.current = { x: 0, y: 0 };
        }
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const { active, over } = event;

        if (!over) {
            setGhostCard(null);
            return;
        }

        const activeCardId = active.data.current?.cardId;
        const activeCard = cards[activeCardId];
        const isTapped = active.data.current?.tapped || activeCard?.tapped;

        // If over a battlefield zone, show ghost card
        if (over.data.current?.type === 'battlefield') {
            const zoneId = over.id as string;
            const targetZone = zones[zoneId];

            if (activeCard && targetZone) {
                // @ts-ignore - over.rect is available at runtime
                const overRect = over.rect;
                const scale = over.data.current?.scale || 1;

                if (!dragPointerStart.current) return;

                const unsnappedPos = calculateRelativePosition(
                    dragPointerStart.current,
                    dragPointerToCenter.current,
                    { x: event.delta.x, y: event.delta.y },
                    overRect,
                    scale
                );



                setGhostCard({
                    zoneId,
                    position: unsnappedPos,
                    tapped: isTapped
                });
            }
        } else {
            setGhostCard(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setGhostCard(null);
        setActiveCardId(null);

        if (over && active.id !== over.id) {
            const cardId = active.data.current?.cardId as CardId;
            const toZoneId = over.data.current?.zoneId as ZoneId;

            const activeCard = cards[cardId];
            const targetZone = zones[toZoneId];

            if (cardId && toZoneId && activeCard && targetZone) {
                if (!canDropToZone(activeCard, targetZone)) {
                    console.warn('Permission denied: Cannot move card to this zone.');
                    return;
                }

                // @ts-ignore - over.rect is available at runtime
                const overRect = over.rect;
                const scale = over.data.current?.scale || 1;

                if (!dragPointerStart.current) return;

                const position = calculateRelativePosition(
                    dragPointerStart.current,
                    dragPointerToCenter.current,
                    { x: event.delta.x, y: event.delta.y },
                    overRect,
                    scale
                );

                moveCard(cardId, toZoneId, position);
            }
        }
    };

    return {
        sensors,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    };
};
