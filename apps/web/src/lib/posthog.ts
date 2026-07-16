import posthog from "posthog-js";

let isInitialized = false;

export const initializePostHog = () => {
  if (isInitialized || typeof window === "undefined") return;
  posthog.init("phc_oYFcMPG9V4ARE4INIzfQQnLmADFN2GRLaYfDFiLSaQ6", {
    api_host: "https://us.i.posthog.com",
    defaults: "2025-11-30",
  });
  isInitialized = true;
};

export const getPostHogDistinctId = (): string | null => {
  if (typeof window === "undefined") return null;
  if (typeof posthog.get_distinct_id !== "function") return null;
  try {
    const id = posthog.get_distinct_id();
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch (_err) {
    return null;
  }
};
