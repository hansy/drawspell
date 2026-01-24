import type { ScryfallFetchError } from "@/services/scryfall/scryfallErrors";

const formatStatus = (error: ScryfallFetchError): string | null => {
  if (!error.status) return null;
  const text = error.statusText ? ` ${error.statusText}` : "";
  return `${error.status}${text}`.trim();
};

export const formatScryfallErrors = (errors: ScryfallFetchError[]): string => {
  if (errors.length === 0) {
    return "Scryfall request failed. Please try again.";
  }

  const rateLimit = errors.find((error) => error.kind === "http" && error.status === 429);
  if (rateLimit) {
    if (rateLimit.retryAfterMs) {
      const seconds = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000));
      return `Scryfall rate limited the request. Please wait ${seconds} seconds and try again.`;
    }
    return "Scryfall rate limited the request. Please wait a moment and try again.";
  }

  const serverError = errors.find(
    (error) => error.kind === "http" && (error.status ?? 0) >= 500
  );
  if (serverError) {
    const status = formatStatus(serverError);
    return `Scryfall is temporarily unavailable${status ? ` (${status})` : ""}. Please try again.`;
  }

  const networkError = errors.find((error) => error.kind === "network");
  if (networkError) {
    return "Network error while contacting Scryfall. Please check your connection and try again.";
  }

  const invalidResponse = errors.find((error) => error.kind === "invalid-response");
  if (invalidResponse) {
    return "Received an unexpected response from Scryfall. Please try again.";
  }

  const httpError = errors.find((error) => error.kind === "http");
  if (httpError) {
    const status = formatStatus(httpError);
    return `Scryfall request failed${status ? ` (${status})` : ""}. Please try again.`;
  }

  return "Scryfall request failed. Please try again.";
};
