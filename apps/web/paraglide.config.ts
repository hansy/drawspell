import type { CompilerOptions } from "@inlang/paraglide-js";

// Used by both Vite and the standalone generator; URLs alone select the locale.
export const paraglideOptions = {
  project: "./project.inlang",
  outdir: "./src/paraglide",
  strategy: ["url", "baseLocale"],
  emitTsDeclarations: true,
  outputStructure: "message-modules",
  trailingSlash: "never",
  isServer: "import.meta.env.SSR",
  routeStrategies: [
    { match: "/api/:path(.*)?", exclude: true },
    { match: "/_serverFn/:path(.*)?", exclude: true },
    { match: "/assets/:path(.*)?", exclude: true },
  ],
} satisfies CompilerOptions;
