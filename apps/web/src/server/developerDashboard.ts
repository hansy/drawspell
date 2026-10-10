import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

/** Authenticate and load private data before rendering, including client navigation. */
export const getDeveloperDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
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
          to: "/auth/login",
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
          ? "Developer access is disabled for this account."
          : "Developer access is temporarily unavailable. Please try again later.",
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
