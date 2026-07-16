import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      lang="en"
      style={{ backgroundColor: "#09090b", colorScheme: "dark" }}
    >
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
  head: () => ({
    meta: [
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
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

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
