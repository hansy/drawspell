import * as React from "react";

export const EXCLUSIVE_ACTIVATION_DELAY_MS = 190;

type PendingActivation<T> = {
  key: string;
  payload: T;
  timeoutId: ReturnType<typeof setTimeout>;
  singleTriggered: boolean;
};

type UseExclusiveActivationParams<T> = {
  getKey: (payload: T) => string;
  onSingle: (payload: T) => void;
  onDouble: (payload: T) => void;
  delayMs?: number;
  triggerSingleImmediately?: boolean;
};

/**
 * Makes single and double activation mutually exclusive. Pointer handlers call
 * `activate` only after confirming the pointer did not turn into a drag.
 * Callers that can roll back their single action may trigger it immediately.
 * `activateDouble` is a fallback for native dblclick events and is suppressed
 * when the pointer sequence already recognized the same double activation.
 */
export const useExclusiveActivation = <T,>({
  getKey,
  onSingle,
  onDouble,
  delayMs = EXCLUSIVE_ACTIVATION_DELAY_MS,
  triggerSingleImmediately = false,
}: UseExclusiveActivationParams<T>) => {
  const pendingRef = React.useRef<PendingActivation<T> | null>(null);
  const lastDoubleRef = React.useRef<{ key: string; at: number } | null>(null);
  const getKeyRef = React.useRef(getKey);
  const onSingleRef = React.useRef(onSingle);
  const onDoubleRef = React.useRef(onDouble);

  React.useEffect(() => {
    getKeyRef.current = getKey;
    onSingleRef.current = onSingle;
    onDoubleRef.current = onDouble;
  }, [getKey, onDouble, onSingle]);

  const clearPending = React.useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return null;
    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    return pending;
  }, []);

  const flushPending = React.useCallback(() => {
    const pending = clearPending();
    if (pending && !pending.singleTriggered) {
      onSingleRef.current(pending.payload);
    }
  }, [clearPending]);

  const cancelPending = clearPending;

  const activate = React.useCallback(
    (payload: T) => {
      const key = getKeyRef.current(payload);
      const pending = pendingRef.current;

      if (pending?.key === key) {
        clearPending();
        lastDoubleRef.current = { key, at: Date.now() };
        onDoubleRef.current(payload);
        return;
      }

      if (pending) flushPending();

      const singleTriggered = triggerSingleImmediately;
      if (singleTriggered) onSingleRef.current(payload);

      const timeoutId = setTimeout(() => {
        const current = pendingRef.current;
        if (!current || current.timeoutId !== timeoutId) return;
        pendingRef.current = null;
        if (!current.singleTriggered) onSingleRef.current(current.payload);
      }, delayMs);
      pendingRef.current = { key, payload, timeoutId, singleTriggered };
    },
    [clearPending, delayMs, flushPending, triggerSingleImmediately]
  );

  const activateDouble = React.useCallback(
    (payload: T) => {
      const key = getKeyRef.current(payload);
      const pending = pendingRef.current;
      if (pending?.key === key) clearPending();
      else if (pending) flushPending();

      const lastDouble = lastDoubleRef.current;
      if (
        lastDouble?.key === key &&
        Date.now() - lastDouble.at < EXCLUSIVE_ACTIVATION_DELAY_MS
      ) {
        return;
      }

      lastDoubleRef.current = { key, at: Date.now() };
      onDoubleRef.current(payload);
    },
    [clearPending, flushPending]
  );

  React.useEffect(
    () => () => {
      clearPending();
    },
    [clearPending]
  );

  return { activate, activateDouble, flushPending, cancelPending };
};
