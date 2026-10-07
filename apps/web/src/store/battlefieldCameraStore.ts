import { create } from "zustand";
import type { Position } from "@mtg/shared/positions";

export const DEFAULT_CAMERA_PAN: Position = { x: 0, y: 0 };
// View-only state, retained when portrait seat switching unmounts a battlefield.
// This store is deliberately absent from room snapshots and intent payloads.
export const useBattlefieldCameraStore = create<{
  pans: Record<string, Position>;
  manual: Record<string, boolean>;
  markManual: (key: string, pan?: Position) => void;
  clear: () => void;
  setPan: (
    key: string,
    value: Position | ((previous: Position) => Position),
  ) => void;
}>((set) => ({
  pans: {},
  manual: {},
  markManual: (key, pan) =>
    set((state) => ({
      manual: { ...state.manual, [key]: true },
      ...(pan ? { pans: { ...state.pans, [key]: pan } } : {}),
    })),
  clear: () => set({ pans: {}, manual: {} }),
  setPan: (key, value) =>
    set((state) => ({
      pans: {
        ...state.pans,
        [key]:
          typeof value === "function"
            ? value(state.pans[key] ?? DEFAULT_CAMERA_PAN)
            : value,
      },
    })),
}));

export const battlefieldCameraKey = (
  sessionId: string | null | undefined,
  viewerId: string,
  playerId: string,
  epoch = 0,
) => `${sessionId}/${viewerId}/${playerId}/${epoch}`;
