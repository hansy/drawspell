import { m } from "@/paraglide/messages.js";
import { ORIGINS, type AppOrigins } from "@mtg/shared/constants/hosts";

export const resolveOriginsForEnv = (viteEnv: string | undefined): AppOrigins => {
  const origins = viteEnv ? ORIGINS[viteEnv as keyof typeof ORIGINS] : undefined;

  if (!origins) {
    throw new Error(m.runtime_origins_unsupported_vite_env({ viteEnv: viteEnv ?? "" }));
  }

  return origins;
};
