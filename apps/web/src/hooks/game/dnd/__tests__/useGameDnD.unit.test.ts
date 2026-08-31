import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { useGameStore } from "@/store/gameStore";
import { useDragStore } from "@/store/dragStore";

import {
  getCurrentPointerScreen,
  getLivePointerCoordinates,
  useGameDnD,
} from "../useGameDnD";

describe("useGameDnD pointer tracking", () => {
  afterEach(() => {
    useDragStore.getState().setActiveCardId(null);
    useDragStore.getState().setActiveCardSnapshot(null);
  });

  it("prefers the live pointer coordinate over activator plus delta", () => {
    const activatorEvent = new MouseEvent("mousedown", {
      clientX: 300,
      clientY: 700,
    });

    const result = getCurrentPointerScreen({
      activatorEvent,
      delta: { x: -1086, y: -420 },
      livePointerScreen: { x: 250, y: 280 },
    });

    expect(result).toEqual({
      point: { x: 250, y: 280 },
      source: "live",
    });
  });

  it("falls back to activator plus delta when no live pointer is available", () => {
    const activatorEvent = new MouseEvent("mousedown", {
      clientX: 300,
      clientY: 700,
    });

    const result = getCurrentPointerScreen({
      activatorEvent,
      delta: { x: -50, y: -220 },
    });

    expect(result).toEqual({
      point: { x: 250, y: 480 },
      source: "delta",
    });
  });

  it("uses the lifted touch rather than a remaining finger on touchend", () => {
    const touchEnd = {
      type: "touchend",
      touches: [{ clientX: 40, clientY: 50 }],
      changedTouches: [{ clientX: 260, clientY: 280 }],
    } as unknown as TouchEvent;

    expect(getLivePointerCoordinates(touchEnd)).toEqual({ x: 260, y: 280 });
  });

  it("routes a placeholder library drag through the secure top-card action", () => {
    const moveTopLibraryCard = vi.fn();
    const placeholder = {
      id: "placeholder:library:p1",
      name: "Card",
      ownerId: "p1",
      controllerId: "p1",
      zoneId: "library-p1",
      tapped: false,
      faceDown: false,
      position: { x: 0.5, y: 0.5 },
      rotation: 0,
      counters: [],
    };
    useGameStore.setState({
      myPlayerId: "p1",
      viewerRole: "player",
      cards: {},
      players: { p1: { id: "p1", libraryCount: 5 } as any },
      zones: {
        "library-p1": {
          id: "library-p1",
          ownerId: "p1",
          type: ZONE.LIBRARY,
          cardIds: [],
        },
        "exile-p1": {
          id: "exile-p1",
          ownerId: "p1",
          type: ZONE.EXILE,
          cardIds: [],
        },
      },
      moveTopLibraryCard,
    });

    const { result } = renderHook(() => useGameDnD({ viewerRole: "player" }));
    const rect = {
      left: 0,
      top: 0,
      right: 80,
      bottom: 112,
      width: 80,
      height: 112,
    };
    const active = {
      id: placeholder.id,
      data: {
        current: {
          cardId: placeholder.id,
          cardSnapshot: placeholder,
          zoneId: placeholder.zoneId,
          ownerId: placeholder.ownerId,
          tapped: false,
        },
      },
      rect: { current: { initial: rect, translated: rect } },
    };

    act(() => {
      result.current.handleDragStart({
        active,
        activatorEvent: new MouseEvent("mousedown", { clientX: 40, clientY: 56 }),
      } as any);
    });
    expect(useDragStore.getState().activeCardSnapshot).toEqual(placeholder);

    act(() => {
      result.current.handleDragEnd({
        active,
        activatorEvent: new MouseEvent("mousedown", { clientX: 40, clientY: 56 }),
        delta: { x: 100, y: 0 },
        over: {
          id: "exile-p1",
          data: { current: { zoneId: "exile-p1", type: ZONE.EXILE } },
          rect,
        },
      } as any);
    });

    expect(moveTopLibraryCard).toHaveBeenCalledWith(
      "p1",
      "exile-p1",
      undefined,
      "p1",
    );
  });
});
