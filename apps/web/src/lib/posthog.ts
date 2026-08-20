import posthog from "posthog-js";
import { ensureClientDeviceId } from "@/lib/partyKitToken";

let isInitialized = false;

export const initializePostHog = () => {
  if (isInitialized || typeof window === "undefined") return;
  posthog.init("phc_oYFcMPG9V4ARE4INIzfQQnLmADFN2GRLaYfDFiLSaQ6", {
    api_host: "https://a.drawspell.space",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    person_profiles: "identified_only",
  });
  posthog.identify(ensureClientDeviceId());
  isInitialized = true;
};
