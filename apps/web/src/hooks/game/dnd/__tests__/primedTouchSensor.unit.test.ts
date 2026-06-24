import { describe, expect, it } from "vitest";

import {
  decidePrimedTouchMove,
  TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
  TOUCH_DRAG_ACTIVATION_DISTANCE_PX,
  TOUCH_DRAG_PRIME_DELAY_MS,
  TOUCH_SCROLL_CANCEL_DISTANCE_PX,
} from "../primedTouchSensor";

describe("primed touch drag sensor", () => {
  it("keeps small movement pending before the drag prime delay", () => {
    expect(
      decidePrimedTouchMove({
        elapsedMs: TOUCH_DRAG_PRIME_DELAY_MS - 1,
        movementPx: TOUCH_SCROLL_CANCEL_DISTANCE_PX,
      })
    ).toBe("pending");
  });

  it("cancels early movement so hand swipes can scroll without dragging", () => {
    expect(
      decidePrimedTouchMove({
        elapsedMs: 100,
        movementPx: TOUCH_SCROLL_CANCEL_DISTANCE_PX + 1,
      })
    ).toBe("cancel");
  });

  it("starts drag only when movement happens after the prime delay", () => {
    expect(
      decidePrimedTouchMove({
        elapsedMs: TOUCH_DRAG_PRIME_DELAY_MS,
        movementPx: TOUCH_DRAG_ACTIVATION_DISTANCE_PX + 1,
      })
    ).toBe("start");
  });

  it("keeps a stationary primed hold pending until context-menu time", () => {
    expect(
      decidePrimedTouchMove({
        elapsedMs: TOUCH_DRAG_PRIME_DELAY_MS + 250,
        movementPx: TOUCH_DRAG_ACTIVATION_DISTANCE_PX,
      })
    ).toBe("pending");
  });

  it("cancels drag activation once the context-menu hold has won", () => {
    expect(
      decidePrimedTouchMove({
        elapsedMs: TOUCH_CONTEXT_MENU_LONG_PRESS_MS,
        movementPx: TOUCH_DRAG_ACTIVATION_DISTANCE_PX + 10,
      })
    ).toBe("cancel");
  });
});
