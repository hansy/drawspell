import { useGameStore } from "../store/gameStore";

export const usePlayerLayout = () => {
  const players = useGameStore((state) => state.players);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const myPlayerId = useGameStore((state) => state.myPlayerId);

  const seen = new Set<string>();
  const orderedByShared = playerOrder
    .map((id) => players[id])
    .filter((player): player is NonNullable<typeof player> => {
      if (!player) return false;
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
  const fallback = Object.values(players)
    .filter((p) => !seen.has(p.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedPlayers = [...orderedByShared, ...fallback];

  // Determine Layout Mode
  const playerCount = sortedPlayers.length;
  let layoutMode: "single" | "split" | "quadrant" = "single";
  if (playerCount >= 3) layoutMode = "quadrant";
  else if (playerCount === 2) layoutMode = "split";

  // Generate Slots based on Mode
  let slots = [];

  // Color mapping based on player index
  const PLAYER_COLORS = ["rose", "violet", "sky", "amber"];

  if (layoutMode === "single") {
    // 1 Player: Full Screen anchored bottom-left
    slots = [
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      },
    ];
  } else if (layoutMode === "split") {
    // 2 Players: Top/Bottom using shared order
    slots = [
      {
        player: sortedPlayers[1],
        position: "top-left",
        color: PLAYER_COLORS[1],
      },
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      },
    ];
  } else {
    // 3+ Players: Quadrants
    // Row 1: TL, TR
    // Row 2: BL, BR
    // Slots follow the shared order so all clients see the same seating.

    slots = [
      {
        player: sortedPlayers[1],
        position: "top-left",
        color: PLAYER_COLORS[1],
      },
      {
        player: sortedPlayers[2],
        position: "top-right",
        color: PLAYER_COLORS[2],
      },
      {
        player: sortedPlayers[0],
        position: "bottom-left",
        color: PLAYER_COLORS[0],
      },
      {
        player: sortedPlayers[3],
        position: "bottom-right",
        color: PLAYER_COLORS[3],
      },
    ];
  }

  return {
    slots,
    layoutMode,
    myPlayerId,
  };
};
