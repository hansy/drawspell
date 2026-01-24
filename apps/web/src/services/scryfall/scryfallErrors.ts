export type ScryfallFetchErrorKind = "network" | "http" | "invalid-response";

export type ScryfallEndpoint = "collection" | "named" | "card";

export type ScryfallFetchError = {
  kind: ScryfallFetchErrorKind;
  endpoint: ScryfallEndpoint;
  url: string;
  status?: number;
  statusText?: string;
  message: string;
  retryAfterMs?: number;
};

export type ScryfallFetchResult<T> = { ok: true; data: T } | { ok: false; error: ScryfallFetchError };

export const parseRetryAfterMs = (response?: Response | null): number | undefined => {
  const retryAfter = response?.headers?.get("Retry-After");
  if (!retryAfter) return undefined;
  const asSeconds = Number(retryAfter);
  if (!Number.isFinite(asSeconds)) return undefined;
  return Math.max(0, asSeconds * 1000);
};

export const buildScryfallHttpError = (params: {
  endpoint: ScryfallEndpoint;
  url: string;
  response: Response;
}): ScryfallFetchError => {
  return {
    kind: "http",
    endpoint: params.endpoint,
    url: params.url,
    status: params.response.status,
    statusText: params.response.statusText,
    retryAfterMs: parseRetryAfterMs(params.response),
    message: `Scryfall responded with ${params.response.status} ${params.response.statusText}`.trim(),
  };
};

export const buildScryfallNetworkError = (params: {
  endpoint: ScryfallEndpoint;
  url: string;
  error: unknown;
}): ScryfallFetchError => {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  return {
    kind: "network",
    endpoint: params.endpoint,
    url: params.url,
    message,
  };
};

export const buildScryfallInvalidResponseError = (params: {
  endpoint: ScryfallEndpoint;
  url: string;
  error?: unknown;
}): ScryfallFetchError => {
  const message = params.error instanceof Error ? params.error.message : String(params.error ?? "");
  return {
    kind: "invalid-response",
    endpoint: params.endpoint,
    url: params.url,
    message: message || "Invalid response payload",
  };
};
