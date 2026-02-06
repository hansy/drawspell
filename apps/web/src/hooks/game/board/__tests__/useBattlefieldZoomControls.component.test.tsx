import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useGameStore } from "@/store/gameStore";
import { useBattlefieldZoomControls } from "../useBattlefieldZoomControls";

const createPointerEvent = (
  type: string,
  options: PointerEventInit & { pointerType?: string; pointerId?: number }
) => {
  if (typeof PointerEvent !== "undefined") {
    return new PointerEvent(type, options);
  }
  const fallback = new MouseEvent(type, options);
  Object.defineProperty(fallback, "pointerType", {
    value: options.pointerType ?? "mouse",
  });
  Object.defineProperty(fallback, "pointerId", {
    value: options.pointerId ?? 1,
  });
  return fallback as unknown as PointerEvent;
};

const Harness: React.FC<{
  target: HTMLElement;
  isBlocked?: boolean;
}> = ({ target, isBlocked = false }) => {
  useBattlefieldZoomControls({
    playerId: "me",
    enabled: true,
    wheelTarget: target,
    isBlocked,
  });
  return null;
};

describe("useBattlefieldZoomControls pinch gestures", () => {
  beforeEach(() => {
    useGameStore.setState((state) => ({
      ...state,
      myPlayerId: "me",
      viewerRole: "player",
      players: {
        me: {
          id: "me",
          name: "Me",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      battlefieldViewScale: { me: 0.9 },
    }));
  });

  it("pinch-away zooms in", () => {
    const target = document.createElement("div");
    render(<Harness target={target} />);

    act(() => {
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 100,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 130,
          clientY: 20,
        })
      );
    });

    expect(useGameStore.getState().battlefieldViewScale.me).toBeCloseTo(0.95);
  });

  it("pinch-together zooms out", () => {
    const target = document.createElement("div");
    render(<Harness target={target} />);

    act(() => {
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 100,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 70,
          clientY: 20,
        })
      );
    });

    expect(useGameStore.getState().battlefieldViewScale.me).toBeCloseTo(0.85);
  });

  it("does not zoom while controls are blocked", () => {
    const target = document.createElement("div");
    render(<Harness target={target} isBlocked />);

    act(() => {
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 100,
          clientY: 20,
        })
      );
      target.dispatchEvent(
        createPointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerType: "touch",
          pointerId: 2,
          clientX: 130,
          clientY: 20,
        })
      );
    });

    expect(useGameStore.getState().battlefieldViewScale.me).toBeCloseTo(0.9);
  });
});
