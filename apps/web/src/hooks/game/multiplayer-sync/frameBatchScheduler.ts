type FrameHandle = number;
type TimerHandle = ReturnType<typeof setTimeout>;

type FrameBatchSchedulerOptions = {
  requestFrame?: (callback: FrameRequestCallback) => FrameHandle;
  cancelFrame?: (handle: FrameHandle) => void;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  fallbackMs?: number;
};

const DEFAULT_FALLBACK_MS = 32;

export const createFrameBatchScheduler = (
  options: FrameBatchSchedulerOptions = {},
) => {
  const requestFrame =
    options.requestFrame ??
    (typeof requestAnimationFrame === "function" ? requestAnimationFrame : undefined);
  const cancelFrame =
    options.cancelFrame ??
    (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : undefined);
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const fallbackMs = options.fallbackMs ?? DEFAULT_FALLBACK_MS;

  let frameHandle: FrameHandle | null = null;
  let timerHandle: TimerHandle | null = null;
  let pending: (() => void) | null = null;

  const cancelHandles = () => {
    if (frameHandle !== null) {
      cancelFrame?.(frameHandle);
      frameHandle = null;
    }
    if (timerHandle !== null) {
      clearTimer(timerHandle);
      timerHandle = null;
    }
  };

  const flush = () => {
    const callback = pending;
    pending = null;
    cancelHandles();
    callback?.();
  };

  return {
    schedule(callback: () => void) {
      pending = callback;
      if (frameHandle !== null || timerHandle !== null) return;

      if (requestFrame) {
        frameHandle = requestFrame(() => flush());
      }
      timerHandle = setTimer(flush, fallbackMs);
    },
    cancel() {
      pending = null;
      cancelHandles();
    },
  };
};
