import { isAppLocale } from "./i18n/locales";
import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";
import { canonicalPageUrl, isLocalizablePath, readLocalePath } from "./i18n/urls";

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    const path = readLocalePath(url.pathname);
    // A locale prefix must never create a second auth/API/asset endpoint.
    if (path.explicit && !isLocalizablePath(path.pathname)) {
      return new Response(null, { status: 404 });
    }
    if (path.explicit && isLocalizablePath(path.pathname)) {
      const canonical = canonicalPageUrl(url, path.locale);
      canonical.search = url.search;
      if (canonical.pathname !== url.pathname) {
        return Response.redirect(canonical, 308);
      }
    }
    if (url.pathname.startsWith("/_serverFn/")) {
      const locale = request.headers.get("X-Drawspell-Locale");
      if (locale && isAppLocale(locale)) {
        return paraglideMiddleware(request, () => handler.fetch(request), {
          effectiveRequestUrl: new URL(locale === "en" ? "/" : `/${locale}`, url),
        });
      }
    }
    // Router rewrite needs the original URL. Middleware supplies request-local locale.
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
