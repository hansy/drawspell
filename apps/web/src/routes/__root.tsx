import { localeMetadata } from "@/i18n/metadata";
import { getLocale } from "@/paraglide/runtime.js";
import { m } from "@/paraglide/messages.js";
import { localeHref } from "@/i18n/navigation";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { SiteLayout } from "@/components/landing/SiteLayout";

function NotFoundPage() {
  return (
    <SiteLayout>
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">{m.not_found_title()}</h1>
        <p className="mt-4 text-zinc-400">
          {m.not_found_description()}
        </p>
        <a href={localeHref("/")} className="mt-8 inline-block text-indigo-300 underline">
          {m.back_to_drawspell()}
        </a>
      </main>
    </SiteLayout>
  );
}

export const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang={getLocale()} style={{ backgroundColor: "#09090b", colorScheme: "dark" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ backgroundColor: "#09090b" }}>
        <AnalyticsInitializer>{children}</AnalyticsInitializer>
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRoute({
  notFoundComponent: NotFoundPage,
  errorComponent: ({ reset }) => (
    <SiteLayout>
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">{m.error_page_title()}</h1>
        <p className="mt-4 text-zinc-400">{m.error_page_description()}</p>
        <button className="mt-8 rounded bg-indigo-600 px-4 py-2" onClick={reset}>{m.error_page_retry()}</button>
      </main>
    </SiteLayout>
  ),
  head: ({ matches }) => {
    const missing = matches.some((match) => match._notFound || match.status === "notFound" || match.status === "error");
    const localized = localeMetadata(missing ? "" : matches.at(-1)?.pathname ?? "");
    return ({
    meta: [
      ...localized.meta,
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
    ],
    links: [
      ...localized.links,
      {
        rel: "preconnect",
        href: "https://cards.scryfall.io",
      },
      {
        rel: "dns-prefetch",
        href: "https://cards.scryfall.io",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  });
  },

  shellComponent: RootDocument,
});

const AnalyticsInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (import.meta.env.VITE_ENV !== "production") return;

    let cancelled = false;
    const initialize = () => {
      void import("../lib/posthog").then(({ initializePostHog }) => {
        if (!cancelled) initializePostHog();
      });
    };

    const timeoutId = window.setTimeout(initialize, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return children;
};
