import { GRID_STEP_Y, clampNormalizedPosition, positionsRoughlyEqual } from './positions';

export type NormalizedPosition = { x: number; y: number };

export type BattlefieldCollisionPatch = {
  id: string;
  position: NormalizedPosition;
};

const positionKey = (position: NormalizedPosition) => `${position.x.toFixed(4)}:${position.y.toFixed(4)}`;

export const computeBattlefieldCollisionPatches = ({
  movingCardId,
  targetPosition,
  orderedCardIds,
  getPosition,
  maxAttempts = 200,
}: {
  movingCardId: string;
  targetPosition: NormalizedPosition;
  orderedCardIds: string[];
  getPosition: (cardId: string) => NormalizedPosition | null | undefined;
  maxAttempts?: number;
}): BattlefieldCollisionPatch[] => {
  const otherIds = orderedCardIds.filter((id) => id !== movingCardId);

  const occupied = new Set<string>();
  const positions: Record<string, NormalizedPosition> = {};

  for (const otherId of otherIds) {
    const pos = getPosition(otherId);
    if (!pos) continue;
    const clamped = clampNormalizedPosition(pos);
    positions[otherId] = clamped;
    occupied.add(positionKey(clamped));
  }

  const reserved = positionKey(clampNormalizedPosition(targetPosition));
  occupied.add(reserved);

  const moved: BattlefieldCollisionPatch[] = [];

  for (const otherId of otherIds) {
    const otherPos = positions[otherId];
    if (!otherPos) continue;
    if (!positionsRoughlyEqual(otherPos, targetPosition)) continue;

    const oldKey = positionKey(otherPos);
    let candidate = clampNormalizedPosition({ x: targetPosition.x, y: otherPos.y + GRID_STEP_Y });
    let attempts = 0;

    while (occupied.has(positionKey(candidate)) && attempts < maxAttempts) {
      candidate = clampNormalizedPosition({ x: candidate.x, y: candidate.y + GRID_STEP_Y });
      attempts += 1;
    }

    if (attempts >= maxAttempts) continue;

    if (oldKey !== reserved) occupied.delete(oldKey);
    occupied.add(positionKey(candidate));
    positions[otherId] = candidate;
    moved.push({ id: otherId, position: candidate });
  }

  return moved;
};

