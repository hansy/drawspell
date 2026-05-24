export type AppOrigins = {
  web: string;
  server: string;
};

/** @deprecated Use AppOrigins instead. */
export type APPS = AppOrigins;

export const ORIGINS: Record<"development" | "staging" | "production", AppOrigins> = {
  development: {
    web: "http://localhost:5173",
    server: "http://localhost:8787",
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
