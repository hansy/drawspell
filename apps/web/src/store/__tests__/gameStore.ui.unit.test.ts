import { createUiActions } from '../gameStore/actions/ui';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../gameStore';
import { ensureLocalStorage } from '@test/utils/storage';

describe('gameStore ui actions', () => {
  beforeAll(() => {
    ensureLocalStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      battlefieldViewScale: {},
      battlefieldGridSizing: {},
      activeModal: null,
      myPlayerId: 'me',
    });
  });

  it('setActiveModal stores modal state', () => {
    useGameStore.getState().setActiveModal({ type: 'ADD_COUNTER', cardIds: ['c1'] });
    expect(useGameStore.getState().activeModal).toEqual({ type: 'ADD_COUNTER', cardIds: ['c1'] });

    useGameStore.getState().setActiveModal(null);
    expect(useGameStore.getState().activeModal).toBeNull();
  });

  it('setBattlefieldViewScale clamps and updates per player', () => {
    useGameStore.getState().setBattlefieldViewScale('me', 0);
    expect(useGameStore.getState().battlefieldViewScale.me).toBe(0.05);

    useGameStore.getState().setBattlefieldViewScale('me', 3);
    expect(useGameStore.getState().battlefieldViewScale.me).toBe(2);

    useGameStore.getState().setBattlefieldViewScale('me', 0.8);
    expect(useGameStore.getState().battlefieldViewScale.me).toBe(0.8);
  });

  it('snaps arbitrary inputs onto fixed five-point levels', () => {
    for (const [input, expected] of [[0.99, 1], [1.031, 1.05], [0.873, 0.85]]) {
      useGameStore.getState().setBattlefieldViewScale('me', input);
      expect(useGameStore.getState().battlefieldViewScale.me).toBe(expected);
    }
  });

  it('allows inspecting another player without dispatching an intent', () => {
    const dispatchIntent = vi.fn();
    const actions = createUiActions(useGameStore.setState, useGameStore.getState, { dispatchIntent });
    actions.setBattlefieldViewScale('opponent', .75);
    expect(useGameStore.getState().battlefieldViewScale.opponent).toBe(.75);
    expect(dispatchIntent).not.toHaveBeenCalled();
  });

  it('setBattlefieldGridSizing stores and clears sizing per player', () => {
    useGameStore.getState().setBattlefieldGridSizing('me', {
      zoneWidthPx: 900,
      zoneHeightPx: 600,
      baseCardHeightPx: 160,
      baseCardWidthPx: 106.6667,
    });

    expect(useGameStore.getState().battlefieldGridSizing.me).toEqual({
      zoneWidthPx: 900,
      zoneHeightPx: 600,
      baseCardHeightPx: 160,
      baseCardWidthPx: 106.6667,
    });

    useGameStore.getState().setBattlefieldGridSizing('me', null);
    expect(useGameStore.getState().battlefieldGridSizing.me).toBeUndefined();
  });
});
