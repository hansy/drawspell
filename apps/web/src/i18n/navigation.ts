import { getLocale } from "@/paraglide/runtime.js";
import { type AppLocale } from "./locales";
import { isLocalizablePath, pageUrlForLocale, readLocalePath } from "./urls";

/** Localize page links only; APIs, external URLs and static resources retain their identity. */
export function localeHref(href: string, locale: AppLocale = getLocale()): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://drawspell.space");
  if (!isLocalizablePath(url.pathname)) return href;
  const result = pageUrlForLocale(url, locale);
  return `${result.pathname}${result.search}${result.hash}`;
}

export function localizeRoomLink(href: string): string {
  if (!href) return href;
  const url = new URL(href, "https://drawspell.space");
  const path = readLocalePath(url.pathname).pathname;
  return path.startsWith("/rooms/") ? pageUrlForLocale(url, getLocale()).href : href;
}
