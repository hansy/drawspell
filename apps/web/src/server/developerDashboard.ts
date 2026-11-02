import { localeHref } from "@/i18n/navigation";
import { isAppLocale, baseLocale } from "@/i18n/locales";
import { m } from "@/paraglide/messages.js";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

/** Authenticate and load private data before rendering, including client navigation. */
export const getDeveloperDashboard = createServerFn({ method: "GET" })
.inputValidator((data: { locale: string }) => ({ locale: isAppLocale(data?.locale) ? data.locale : baseLocale }))
.handler(
  async ({ data }) => {
    const { getRequestHeaders, setResponseHeader, setResponseStatus } =
      await import("@tanstack/react-start/server");
    const { DeveloperAuthError, listDeveloperKeys } = await import("@mtg/auth");
    const { developerAuth } = await import("./developerAuth");
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("Referrer-Policy", "no-referrer");
    try {
      return {
        status: "ready" as const,
        keys: await listDeveloperKeys(developerAuth(), getRequestHeaders()),
      };
    } catch (error) {
      if (error instanceof DeveloperAuthError && error.status === 401) {
        throw redirect({
          href: localeHref("/auth/login", data.locale),
          statusCode: 303,
          headers: { "Cache-Control": "private, no-store" },
        });
      }
      const forbidden =
        error instanceof DeveloperAuthError && error.status === 403;
      setResponseStatus(forbidden ? 403 : 503);
      return {
        status: "error" as const,
        message: forbidden
          ? m.developer_dashboard_developer_access_is_disabled_for_this_account({}, { locale: data.locale })
          : m.developer_dashboard_developer_access_is_temporarily_unavailable_please_try_again_late({}, { locale: data.locale }),
      };
    }
  },
);

// SSR builds its own Response, so carry through auth failure statuses explicitly.
export const developerResponseStatus = createMiddleware().server(
  async ({ next }) => {
    const result = await next();
    const { getResponseStatus } = await import("@tanstack/react-start/server");
    const status = getResponseStatus();
    if (status >= 400 && result.response.ok) {
      return {
        ...result,
        response: new Response(result.response.body, {
          status,
          headers: result.response.headers,
        }),
      };
    }
    return result;
  },
);
