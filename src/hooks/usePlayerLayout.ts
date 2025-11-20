import { useGameStore } from '../store/gameStore';

export const usePlayerLayout = () => {
    const players = useGameStore((state) => state.players);
    const myPlayerId = useGameStore((state) => state.myPlayerId);

    // Get all players
    const allPlayers = Object.values(players);

    // Sort players to put "Me" first, then others
    // But for the grid, we want "Me" at index 0 (Bottom Left), then rotate clockwise?
    // Let's define the slots:
    // 2 (TL) | 3 (TR)
    // -------+-------
    // 0 (BL) | 1 (BR)

    // We need to reorder the players array so that myPlayerId is at index 0.
    const myIndex = allPlayers.findIndex(p => p.id === myPlayerId);
    const sortedPlayers = myIndex !== -1
        ? [
            ...allPlayers.slice(myIndex),
            ...allPlayers.slice(0, myIndex)
        ]
        : allPlayers;

    // Determine Layout Mode
    const playerCount = allPlayers.length;
    let layoutMode: 'single' | 'split' | 'quadrant' = 'single';
    if (playerCount >= 3) layoutMode = 'quadrant';
    else if (playerCount === 2) layoutMode = 'split';

    // Generate Slots based on Mode
    let slots = [];

    if (layoutMode === 'single') {
        // 1 Player: Full Screen
        slots = [
            { player: sortedPlayers[0], position: 'bottom-left', color: 'blue' } // Me (using BL styles but full screen)
        ];
    } else if (layoutMode === 'split') {
        // 2 Players: Top/Bottom
        // Top: Opponent
        // Bottom: Me
        slots = [
            { player: sortedPlayers[1], position: 'top-left', color: 'red' },    // Opponent (using TL styles for top)
            { player: sortedPlayers[0], position: 'bottom-left', color: 'blue' } // Me (using BL styles for bottom)
        ];
    } else {
        // 3+ Players: Quadrants
        // Row 1: TL, TR
        // Row 2: BL, BR
        slots = [
            { player: sortedPlayers[2], position: 'top-left', color: 'green' },   // TL
            { player: sortedPlayers[3], position: 'top-right', color: 'yellow' }, // TR
            { player: sortedPlayers[0], position: 'bottom-left', color: 'blue' }, // BL (Me)
            { player: sortedPlayers[1], position: 'bottom-right', color: 'red' }, // BR
        ];
    }

    return {
        slots,
        layoutMode,
        myPlayerId
    };
};
