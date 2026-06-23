/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: string;
  readonly VITE_ENABLE_CURATED_DECKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
