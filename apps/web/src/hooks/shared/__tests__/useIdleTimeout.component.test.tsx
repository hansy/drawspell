import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdleTimeout } from "../useIdleTimeout";

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onTimeout after the idle period", () => {
    const onTimeout = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: true,
        timeoutMs: 1000,
        pollIntervalMs: 100,
        onTimeout,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on activity", () => {
    const onTimeout = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: true,
        timeoutMs: 1000,
        pollIntervalMs: 100,
        onTimeout,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("fires warning and resume callbacks", () => {
    const onWarning = vi.fn();
    const onResume = vi.fn();

    renderHook(() =>
      useIdleTimeout({
        enabled: true,
        timeoutMs: 1000,
        warningMs: 200,
        pollIntervalMs: 100,
        onTimeout: vi.fn(),
        onWarning,
        onResume,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onWarning).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(onResume).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
});
