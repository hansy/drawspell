import { parseRetryAfterMs } from "./scryfallErrors";

export type ScryfallRequest = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

/** One request queue per browser: imports, lookups, tokens and translations share it. */
export function createScryfallRequest({
  fetchImpl = (...args) => globalThis.fetch(...args),
  spacingMs = 120,
  now = () => Date.now(),
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  fetchImpl?: ScryfallRequest;
  spacingMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
} = {}): ScryfallRequest {
  let nextStart = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const request = queue.then(async () => {
      signal?.throwIfAborted();
      // Re-check after sleeping: a previous request may have imposed a cooldown.
      while (nextStart > now()) {
        await sleep(nextStart - now());
        signal?.throwIfAborted();
      }
      nextStart = now() + spacingMs;
      const response = await fetchImpl(input, init);
      if (response.status === 429) {
        nextStart = Math.max(nextStart, now() + Math.max(1_000, parseRetryAfterMs(response, now()) ?? 1_000));
      }
      return response;
    });
    // Failed/aborted requests must not poison the queue for subsequent callers.
    queue = request.catch(() => undefined);
    return request;
  };
}

export const scryfallRequest = createScryfallRequest();
