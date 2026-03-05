/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_HOST?: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
