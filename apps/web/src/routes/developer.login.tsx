import { localeHref } from "@/i18n/navigation";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/developer/login")({
  beforeLoad: () => {
    throw redirect({ href: localeHref("/auth/login"), statusCode: 308 });
  },
});
