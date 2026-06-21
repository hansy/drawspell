import { describe, expect, it } from 'vitest';
import {
  clampNormalizedPosition,
  getCanonicalBattlefieldPlacementGridSteps,
} from '../positions';
import {
  resolveBattlefieldCollisionPosition,
  resolveBattlefieldGroupCollisionPositions,
} from '../battlefieldCollision';

describe('resolveBattlefieldCollisionPosition', () => {
  it('returns the target when the center is unoccupied', () => {
    const position = resolveBattlefieldCollisionPosition({
      movingCardId: 'c1',
      targetPosition: { x: 0.5, y: 0.5 },
      orderedCardIds: ['c1', 'c2'],
      getPosition: (id) => (id === 'c2' ? { x: 0.25, y: 0.25 } : null),
    });

    expect(position).toEqual({ x: 0.5, y: 0.5 });
  });

  it('moves the incoming card down by one grid step when occupied', () => {
    const { stepY } = getCanonicalBattlefieldPlacementGridSteps();
    const position = resolveBattlefieldCollisionPosition({
      movingCardId: 'c1',
      targetPosition: { x: 0.5, y: 0.5 },
      orderedCardIds: ['c1', 'c2'],
      getPosition: (id) => (id === 'c2' ? { x: 0.5, y: 0.5 } : null),
    });

    expect(position).toEqual(
      clampNormalizedPosition({ x: 0.5, y: 0.5 + stepY })
    );
  });

  it('accepts a custom visible grid row size', () => {
    const stepY = 0.125;
    const position = resolveBattlefieldCollisionPosition({
      movingCardId: 'c1',
      targetPosition: { x: 0.5, y: 0.5 },
      orderedCardIds: ['c1', 'c2'],
      getPosition: (id) => (id === 'c2' ? { x: 0.5, y: 0.5 } : null),
      stepY,
    });

    expect(position).toEqual(
      clampNormalizedPosition({ x: 0.5, y: 0.5 + stepY })
    );
  });

  it('cascades until a free spot is found', () => {
    const { stepY } = getCanonicalBattlefieldPlacementGridSteps();
    const target = { x: 0.5, y: 0.5 };
    const occupied = clampNormalizedPosition({ x: 0.5, y: target.y + stepY });

    const position = resolveBattlefieldCollisionPosition({
      movingCardId: 'c1',
      targetPosition: target,
      orderedCardIds: ['c1', 'c2', 'c3'],
      getPosition: (id) => {
        if (id === 'c2') return target;
        if (id === 'c3') return occupied;
        return null;
      },
    });

    expect(position.x).toBeCloseTo(0.5, 6);
    expect(position.y).toBeCloseTo(target.y + stepY * 2, 6);
  });

  it('keeps the original target if no free spot is found', () => {
    const position = resolveBattlefieldCollisionPosition({
      movingCardId: 'c1',
      targetPosition: { x: 0.5, y: 1 },
      orderedCardIds: ['c1', 'c2'],
      getPosition: (id) => (id === 'c2' ? { x: 0.5, y: 1 } : null),
      maxAttempts: 3,
    });

    expect(position).toEqual({ x: 0.5, y: 1 });
  });
});

describe('resolveBattlefieldGroupCollisionPositions', () => {
  it('moves only cards targeting occupied centers and leaves others unchanged', () => {
    const { stepY } = getCanonicalBattlefieldPlacementGridSteps();
    const resolved = resolveBattlefieldGroupCollisionPositions({
      movingCardIds: ['m1', 'm2'],
      targetPositions: {
        m1: { x: 0.5, y: 0.5 },
        m2: { x: 0.25, y: 0.25 },
      },
      orderedCardIds: ['m1', 'm2', 'c1'],
      getPosition: (id) => (id === 'c1' ? { x: 0.5, y: 0.5 } : null),
    });

    expect(resolved.m1).toEqual(
      clampNormalizedPosition({ x: 0.5, y: 0.5 + stepY })
    );
    expect(resolved.m2).toEqual({ x: 0.25, y: 0.25 });
  });

  it('avoids duplicate centers among moved cards', () => {
    const { stepY } = getCanonicalBattlefieldPlacementGridSteps();
    const resolved = resolveBattlefieldGroupCollisionPositions({
      movingCardIds: ['m1', 'm2'],
      targetPositions: {
        m1: { x: 0.5, y: 0.5 },
        m2: { x: 0.5, y: 0.5 },
      },
      orderedCardIds: ['m1', 'm2'],
      getPosition: () => null,
    });

    expect(resolved.m1).toEqual({ x: 0.5, y: 0.5 });
    expect(resolved.m2).toEqual(
      clampNormalizedPosition({ x: 0.5, y: 0.5 + stepY })
    );
  });
});
