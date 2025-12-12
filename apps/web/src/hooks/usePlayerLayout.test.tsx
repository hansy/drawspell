import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { usePlayerLayout } from './usePlayerLayout';
import { useGameStore } from '../store/gameStore';

type ProbeValue = ReturnType<typeof usePlayerLayout>;

const resetStore = () => {
  act(() => {
    useGameStore.setState({
      players: {},
      playerOrder: [],
      cards: {},
      zones: {},
      battlefieldViewScale: {},
      sessionId: 'test-session',
      myPlayerId: 'me',
      playerIdsBySession: {},
      sessionVersions: {},
      positionFormat: 'normalized',
      globalCounters: {},
      activeModal: null,
      hasHydrated: true,
    });
  });
};

const createPlayer = (id: string) => ({
  id,
  name: id.toUpperCase(),
  life: 40,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

const Probe: React.FC<{ onValue: (value: ProbeValue) => void }> = ({ onValue }) => {
  const value = usePlayerLayout();
  React.useEffect(() => {
    onValue(value);
  }, [value, onValue]);
  return null;
};

describe('usePlayerLayout', () => {
  beforeEach(() => {
    resetStore();
  });

  it('uses shared playerOrder for seat positions (split layout)', async () => {
    const pA = createPlayer('pA');
    const pB = createPlayer('pB');

    act(() => {
      useGameStore.setState((state) => ({
        ...state,
        players: { pA, pB },
        playerOrder: ['pB', 'pA'],
        myPlayerId: 'pA',
      }));
    });

    let result: ProbeValue | null = null;
    render(<Probe onValue={(v) => { result = v; }} />);

    await waitFor(() => {
      expect(result).not.toBeNull();
      expect(result?.layoutMode).toBe('split');
      const bottom = result?.slots.find((s) => s.position === 'bottom-left')?.player?.id;
      const top = result?.slots.find((s) => s.position === 'top-left')?.player?.id;
      expect(bottom).toBe('pB'); // first in shared order
      expect(top).toBe('pA'); // second in shared order
    });
  });

  it('falls back to sorted players when playerOrder is missing/invalid', async () => {
    const pA = createPlayer('pA');
    const pB = createPlayer('pB');

    act(() => {
      useGameStore.setState((state) => ({
        ...state,
        players: { pA, pB },
        playerOrder: ['pZ'], // invalid entry ignored
        myPlayerId: 'pA',
      }));
    });

    let result: ProbeValue | null = null;
    render(<Probe onValue={(v) => { result = v; }} />);

    await waitFor(() => {
      expect(result).not.toBeNull();
      expect(result?.layoutMode).toBe('split');
      const bottom = result?.slots.find((s) => s.position === 'bottom-left')?.player?.id;
      const top = result?.slots.find((s) => s.position === 'top-left')?.player?.id;
      expect(bottom).toBe('pA'); // alphabetical fallback
      expect(top).toBe('pB');
    });
  });
});
