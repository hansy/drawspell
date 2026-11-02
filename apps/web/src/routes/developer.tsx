import { readLocalePath } from "@/i18n/urls";
import { localeHref } from "@/i18n/navigation";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/developer")({
  beforeLoad: ({ location }) => {
    if (readLocalePath(location.pathname).pathname === "/developer")
      throw redirect({ href: localeHref("/developers"), statusCode: 308 });
  },
});
