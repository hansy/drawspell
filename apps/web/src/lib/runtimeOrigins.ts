import { ORIGINS, type APPS } from "@mtg/shared/constants/hosts";

export const resolveOriginsForEnv = (viteEnv: string | undefined): APPS => {
  const origins = viteEnv ? ORIGINS[viteEnv as keyof typeof ORIGINS] : undefined;

  if (!origins) {
    throw new Error(`Unsupported VITE_ENV: ${viteEnv}`);
  }

  return origins;
};
