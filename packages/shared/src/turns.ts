import type { Player } from "./types/players";

type TurnPlayer = Pick<Player, "deckLoaded" | "out">;

export const POISON_LOSS_COUNT = 10;
export const COMMANDER_DAMAGE_LOSS = 21;

export type LossReason = "life" | "poison" | "commander";

// A player with no deck, or who is out, has their turns skipped.
export const isTurnEligible = (player: TurnPlayer | null | undefined): boolean =>
  Boolean(player?.deckLoaded && !player.out);

// The game rules that put a player out without anyone having to say so.
export const resolveLossReason = (
  player: Pick<Player, "life" | "counters" | "commanderDamage"> | null | undefined,
): LossReason | null => {
  if (!player) return null;
  if (Number.isFinite(player.life) && player.life <= 0) return "life";
  const poison = (player.counters ?? []).find(
    (counter) => counter.type.trim().toLowerCase() === "poison",
  );
  if ((poison?.count ?? 0) >= POISON_LOSS_COUNT) return "poison";
  if (
    Object.values(player.commanderDamage ?? {}).some(
      (damage) => damage >= COMMANDER_DAMAGE_LOSS,
    )
  ) {
    return "commander";
  }
  return null;
};

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
