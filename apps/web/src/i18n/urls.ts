import { baseLocale, languageRegistry, type AppLocale } from "./locales";

// Only page routes participate in localization. Protocol and static URLs do not.
export const isLocalizablePath = (pathname: string): boolean =>
  !/^\/(?:api|_server|_serverFn|__tsr|_build|assets|cdn-cgi|ws)(?:\/|$)/.test(pathname) &&
  !/^\/[^/]+\.[^/]+$/.test(pathname);

export const readLocalePath = (pathname: string) => {
  const prefix = pathname.split("/")[1] ?? "";
  const locale = languageRegistry.find(
    (language) => language.locale.toLowerCase() === prefix.toLowerCase(),
  )?.locale;
  return {
    locale: locale ?? baseLocale,
    explicit: Boolean(locale),
    pathname: locale ? pathname.slice(prefix.length + 1) || "/" : pathname,
  };
};

/** Pure URL contract used around Paraglide; no browser/global locale state. */
export function pageUrlForLocale(url: URL, locale: AppLocale): URL {
  const result = new URL(url);
  const { pathname } = readLocalePath(result.pathname);
  // Do not turn /es/api/... into an API alias; the server must reject it.
  if (!isLocalizablePath(pathname)) return result;
  result.pathname = locale === baseLocale
    ? pathname
    : `/${locale}${pathname === "/" ? "" : pathname}`;
  return result;
}

/** Canonical metadata intentionally drops query strings and invite credentials. */
export function canonicalPageUrl(url: URL, locale: AppLocale): URL {
  const result = pageUrlForLocale(url, locale);
  result.search = "";
  result.hash = "";
  return result;
}
