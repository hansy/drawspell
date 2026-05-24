import { ORIGINS, type AppOrigins } from "@mtg/shared/constants/hosts";

export const resolveOriginsForEnv = (viteEnv: string | undefined): AppOrigins => {
  const origins = viteEnv ? ORIGINS[viteEnv as keyof typeof ORIGINS] : undefined;

  if (!origins) {
    throw new Error(`Unsupported VITE_ENV: ${viteEnv}`);
  }

  return origins;
};
