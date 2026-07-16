import { describe, expect, it, vi } from "vitest";

import { createFrameBatchScheduler } from "../frameBatchScheduler";

describe("createFrameBatchScheduler", () => {
  it("coalesces a burst into one next-frame callback", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const cancelFrame = vi.fn();
    const clearTimer = vi.fn();
    const callback = vi.fn();
    const scheduler = createFrameBatchScheduler({
      requestFrame: (next) => {
        frameCallback = next;
        return 7;
      },
      cancelFrame,
      setTimer: () => 9 as unknown as ReturnType<typeof setTimeout>,
      clearTimer,
    });

    for (let index = 0; index < 100; index += 1) {
      scheduler.schedule(callback);
    }
    expect(frameCallback).not.toBeNull();

    (frameCallback as unknown as FrameRequestCallback)(16);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(clearTimer).toHaveBeenCalledWith(9);
  });

  it("uses the timer fallback when a frame does not arrive", () => {
    let timerCallback: (() => void) | null = null;
    const callback = vi.fn();
    const scheduler = createFrameBatchScheduler({
      requestFrame: () => 4,
      cancelFrame: vi.fn(),
      setTimer: (next) => {
        timerCallback = next;
        return 5 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: vi.fn(),
    });

    scheduler.schedule(callback);
    (timerCallback as unknown as () => void)();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels pending work during teardown", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const callback = vi.fn();
    const scheduler = createFrameBatchScheduler({
      requestFrame: (next) => {
        frameCallback = next;
        return 2;
      },
      cancelFrame: vi.fn(),
      setTimer: () => 3 as unknown as ReturnType<typeof setTimeout>,
      clearTimer: vi.fn(),
    });

    scheduler.schedule(callback);
    scheduler.cancel();
    (frameCallback as unknown as FrameRequestCallback)(16);

    expect(callback).not.toHaveBeenCalled();
  });
});
