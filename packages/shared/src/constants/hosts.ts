export type AppOrigins = {
  web: string;
  server: string;
};

/** @deprecated Use AppOrigins instead. */
export type APPS = AppOrigins;

export const ORIGINS: Record<"development" | "staging" | "production", AppOrigins> = {
  development: {
    web: "https://ds.localhost",
    server: "https://server.ds.localhost",
  },
  staging: {
    web: "https://staging.drawspell.space",
    server: "https://staging.ws.drawspell.space",
  },
  production: {
    web: "https://drawspell.space",
    server: "https://ws.drawspell.space",
  },
};
