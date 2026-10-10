import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/developer/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/login", statusCode: 308 });
  },
});
