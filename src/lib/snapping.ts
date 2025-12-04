import { CARD_WIDTH_PX, CARD_HEIGHT_PX } from './constants';
import { Card, CardId } from '../types';

export const SNAP_GRID_SIZE = 30;
export const SNAP_THRESHOLD = 0.5;

export const snapToGrid = (value: number, gridSize: number = SNAP_GRID_SIZE): number => {
    const snapped = Math.floor(value / gridSize + SNAP_THRESHOLD) * gridSize;
    return snapped;
};

export const getSnappedPosition = (x: number, y: number) => {
    // Incoming x,y are the card center in zone space.
    // Snap the *top-left corner* to the grid, then convert back to center
    // so that card edges visually align with grid lines.
    const left = x - CARD_WIDTH_PX / 2;
    const top = y - CARD_HEIGHT_PX / 2;

    const snappedLeft = snapToGrid(left);
    const snappedTop = snapToGrid(top);

    return {
        x: snappedLeft + CARD_WIDTH_PX / 2,
        y: snappedTop + CARD_HEIGHT_PX / 2
    };
};

export const findAvailablePosition = (
    start: { x: number; y: number },
    zoneCardIds: CardId[],
    cards: Record<CardId, Card>,
    step: number = SNAP_GRID_SIZE,
    maxChecks: number = 50
) => {
    const occupied = new Set<string>();
    zoneCardIds.forEach(id => {
        const card = cards[id];
        if (card) {
            occupied.add(`${card.position.x}:${card.position.y}`);
        }
    });

    let candidate = { ...start };
    let attempts = 0;
    while (occupied.has(`${candidate.x}:${candidate.y}`) && attempts < maxChecks) {
        candidate = { x: candidate.x + step, y: candidate.y + step };
        attempts += 1;
    }

    return candidate;
};
