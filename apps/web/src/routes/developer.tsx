import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/developer")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/developer")
      throw redirect({ to: "/developers", statusCode: 308 });
  },
});
