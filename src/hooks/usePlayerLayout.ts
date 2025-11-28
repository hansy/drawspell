import { useGameStore } from "../store/gameStore";

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
  const myIndex = allPlayers.findIndex((p) => p.id === myPlayerId);
  const sortedPlayers =
    myIndex !== -1
      ? [...allPlayers.slice(myIndex), ...allPlayers.slice(0, myIndex)]
      : allPlayers;

  // Determine Layout Mode
  const playerCount = allPlayers.length;
  let layoutMode: "single" | "split" | "quadrant" = "single";
  if (playerCount >= 3) layoutMode = "quadrant";
  else if (playerCount === 2) layoutMode = "split";

  // Generate Slots based on Mode
  let slots = [];

  // Color mapping based on player index
  const PLAYER_COLORS = ["rose", "violet", "sky", "amber"];

  if (layoutMode === "single") {
    // 1 Player: Full Screen
    slots = [
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      }, // Me (Red)
    ];
  } else if (layoutMode === "split") {
    // 2 Players: Top/Bottom
    // Top: Opponent
    // Bottom: Me
    slots = [
      {
        player: sortedPlayers[1],
        position: "top-left",
        color: PLAYER_COLORS[1],
      }, // Opponent (Green)
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      }, // Me (Red)
    ];
  } else {
    // 3+ Players: Quadrants
    // Row 1: TL, TR
    // Row 2: BL, BR
    // We need to map sortedPlayers to these slots.
    // sortedPlayers[0] is ME.
    // In quadrant mode:
    // Me -> BL (Slot 2)
    // P2 -> TL (Slot 0)
    // P3 -> TR (Slot 1)
    // P4 -> BR (Slot 3)

    // Let's assign colors based on the player's original index/ID to keep it consistent?
    // Or just based on the slot for now as per request "predetermined upon loading".
    // The request says: Red (P1), Green (P2), Blue (P3), Yellow (P4).
    // Let's assume sortedPlayers order is P1, P2, P3, P4 relative to "Me".

    slots = [
      {
        player: sortedPlayers[1],
        position: "top-left",
        color: PLAYER_COLORS[1],
      }, // TL (Green)
      {
        player: sortedPlayers[2],
        position: "top-right",
        color: PLAYER_COLORS[2],
      }, // TR (Blue)
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      }, // BL (Me - Red)
      {
        player: sortedPlayers[3],
        position: "bottom-right",
        color: PLAYER_COLORS[3],
      }, // BR (Yellow)
    ];
  }

  return {
    slots,
    layoutMode,
    myPlayerId,
  };
};
