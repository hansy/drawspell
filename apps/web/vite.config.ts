import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const modernizeManaFont = () => ({
  name: "drawspell-modern-mana-font",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    const normalizedId = id.split("?", 1)[0]?.replaceAll("\\", "/");
    if (!normalizedId?.endsWith("/mana-font/css/mana.css")) return null;

    const rulesStart = code.indexOf(".ms {");
    if (rulesStart === -1) return null;

    return {
      code: `@font-face {
  font-family: "Mana";
  src: url("../fonts/mana.woff2?v=1.18.0") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}\n${code.slice(rulesStart)}`,
      map: null,
    };
  },
});

const config = defineConfig(() => ({
  plugins: [
    modernizeManaFont(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));

export default config;
