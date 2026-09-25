import type { Player } from "./types/players";

type TurnPlayer = Pick<Player, "life" | "deckLoaded">;

export const isTurnEligible = (player: TurnPlayer | null | undefined): boolean =>
  Boolean(player?.deckLoaded && Number.isFinite(player.life) && player.life > 0);

export const nextEligibleTurnPlayerId = (
  order: readonly string[],
  players: Record<string, TurnPlayer | null | undefined>,
  afterPlayerId?: string | null,
): string | null => {
  if (order.length === 0) return null;
  const currentIndex = afterPlayerId ? order.indexOf(afterPlayerId) : -1;
  for (let offset = 1; offset <= order.length; offset += 1) {
    const id = order[(currentIndex + offset) % order.length];
    if (isTurnEligible(players[id])) return id;
  }
  return null;
};

export const resolveActiveTurnPlayerId = (
  order: readonly string[],
  players: Record<string, TurnPlayer | null | undefined>,
  activePlayerId?: string | null,
): string | null =>
  activePlayerId && order.includes(activePlayerId) && isTurnEligible(players[activePlayerId])
    ? activePlayerId
    : nextEligibleTurnPlayerId(order, players, activePlayerId);
