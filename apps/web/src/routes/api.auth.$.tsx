import { createFileRoute } from "@tanstack/react-router";
async function handle(request: Request) {
  const { developerAuthHandler } = await import("@/server/developerAuth");
  return developerAuthHandler(request);
}
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
    },
  },
});
