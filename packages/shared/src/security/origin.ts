export const normalizeOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
};

export const isOriginAllowed = (
  origin: string | null,
  allowedOrigin: string | null,
): boolean => {
  if (!allowedOrigin || !origin) return false;

  const normalizedOrigin = normalizeOrigin(origin);
  return normalizedOrigin === allowedOrigin;
};

export const isDevelopmentEnv = (envName: string | undefined): boolean =>
  envName === "development";
