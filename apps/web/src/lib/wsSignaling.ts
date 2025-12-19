export const buildSignalingUrlFromEnv = (envUrl: string | undefined): string | null => {
  if (!envUrl) return null;

  const normalized = envUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return normalized.endsWith("/signal") ? normalized : `${normalized}/signal`;
};

