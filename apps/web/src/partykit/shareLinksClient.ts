import { v4 as uuidv4 } from "uuid";

import type {
  ShareLinksPayload,
  ShareLinksRequestMessage,
  ShareLinksResponseMessage,
} from "./messages";
import { sendPartyMessage } from "./intentTransport";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_INTERVAL_MS = 250;
const ABORT_ERROR_MESSAGE = "share links request aborted";

type PendingShareLinksRequest = {
  resolve: (payload: ShareLinksPayload) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  retryId: ReturnType<typeof setTimeout> | null;
  abortListener?: (() => void) | null;
};

type RequestShareLinksOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  retryIntervalMs?: number;
};

const pendingRequests = new Map<string, PendingShareLinksRequest>();

const abortError = () => new Error(ABORT_ERROR_MESSAGE);

const clearPendingRequest = (requestId: string) => {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;
  if (pending.timeoutId) {
    clearTimeout(pending.timeoutId);
  }
  if (pending.retryId) {
    clearTimeout(pending.retryId);
  }
  pending.abortListener?.();
  pendingRequests.delete(requestId);
};

const rejectPendingRequest = (requestId: string, error: Error) => {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;
  clearPendingRequest(requestId);
  pending.reject(error);
};

export const isAbortedShareLinksRequest = (error: unknown): boolean =>
  error instanceof Error && error.message === ABORT_ERROR_MESSAGE;

export const requestShareLinks = ({
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryIntervalMs = DEFAULT_RETRY_INTERVAL_MS,
}: RequestShareLinksOptions = {}): Promise<ShareLinksPayload> => {
  if (signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise<ShareLinksPayload>((resolve, reject) => {
    const requestId = uuidv4();
    const message: ShareLinksRequestMessage = {
      type: "shareLinksRequest",
      requestId,
    };

    const fail = (reason: string) => {
      rejectPendingRequest(requestId, new Error(reason));
    };

    const attemptSend = () => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return;
      if (signal?.aborted) {
        rejectPendingRequest(requestId, abortError());
        return;
      }
      if (sendPartyMessage(message)) return;
      pending.retryId = setTimeout(attemptSend, retryIntervalMs);
    };

    const pending: PendingShareLinksRequest = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        fail("Unable to load invite links.");
      }, timeoutMs),
      retryId: null,
      abortListener: null,
    };

    if (signal) {
      const onAbort = () => {
        rejectPendingRequest(requestId, abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      pending.abortListener = () => {
        signal.removeEventListener("abort", onAbort);
      };
    }

    pendingRequests.set(requestId, pending);
    attemptSend();
  });
};

export const handleShareLinksResponse = (message: ShareLinksResponseMessage) => {
  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;
  clearPendingRequest(message.requestId);
  if (message.ok && message.payload) {
    pending.resolve(message.payload);
    return;
  }
  pending.reject(new Error(message.error || "Unable to load invite links."));
};

export const resetShareLinksRequestsForTests = () => {
  for (const requestId of [...pendingRequests.keys()]) {
    rejectPendingRequest(requestId, new Error("reset"));
  }
};
