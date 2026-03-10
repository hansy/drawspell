export type APPS = {
  web: string;
  server: string;
};

export const ORIGINS: Record<"development" | "staging" | "production", APPS> = {
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
