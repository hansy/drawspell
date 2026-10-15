import { ORIGINS } from "@mtg/shared/constants/hosts";

export const parseBearerToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  return rest.join(" ").trim() || null;
};

export const resolveDrawspellWebOrigin = (
  env: Pick<Env, "NODE_ENV">,
): string | null => ORIGINS[env.NODE_ENV as keyof typeof ORIGINS]?.web ?? null;

export const resolveErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "unknown";
};
