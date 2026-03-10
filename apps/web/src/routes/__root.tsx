import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PostHogProvider } from "posthog-js/react";
import appCss from "../styles.css?url";

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <PHProvider>{children}</PHProvider>
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

const PHProvider = ({ children }: { children: React.ReactNode }) => {
  if (import.meta.env.VITE_ENV !== "production") {
    return children;
  }

  return (
    <PostHogProvider
      apiKey={"phc_oYFcMPG9V4ARE4INIzfQQnLmADFN2GRLaYfDFiLSaQ6"}
      options={{
        api_host: "https://us.i.posthog.com",
        defaults: "2025-11-30",
      }}
    >
      {children}
    </PostHogProvider>
  );
};
