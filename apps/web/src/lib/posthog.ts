import posthog from "posthog-js";
import { ensureClientDeviceId } from "@/lib/partyKitToken";

let isInitialized = false;

export const initializePostHog = () => {
  if (isInitialized || typeof window === "undefined") return;
  posthog.init("phc_oYFcMPG9V4ARE4INIzfQQnLmADFN2GRLaYfDFiLSaQ6", {
    api_host: "https://us.i.posthog.com",
    defaults: "2025-11-30",
  });
  posthog.identify(ensureClientDeviceId());
  isInitialized = true;
};
