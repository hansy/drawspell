import { languageRegistry } from "./locales";
import { getLocale } from "@/paraglide/runtime.js";
import { canonicalPageUrl, readLocalePath } from "./urls";
import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";

export const indexablePaths = ["/", "/docs", "/privacy", "/tos"];
export function localeMetadata(pathname: string) {
  const path = readLocalePath(pathname).pathname;
  if (import.meta.env.VITE_ENV !== "production" || !indexablePaths.includes(path)) return { meta: [{ name: "robots", content: "noindex, nofollow" }], links: [] };
  const url = new URL(path, resolveOriginsForEnv(import.meta.env.VITE_ENV).web);
  return {
    meta: [{ property: "og:url", content: canonicalPageUrl(url, getLocale()).href }],
    links: [
      { rel: "canonical", href: canonicalPageUrl(url, getLocale()).href },
      ...languageRegistry.map(({ locale }) => ({
        rel: "alternate", hrefLang: locale, href: canonicalPageUrl(url, locale).href,
      })),
      { rel: "alternate", hrefLang: "x-default", href: canonicalPageUrl(url, "en").href },
    ],
  };
}
