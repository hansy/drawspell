import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/v1/rooms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [
            { developerAuth, getDeveloperEnv },
            { handlePublicRoomRequest },
          ] = await Promise.all([
            import("@/server/developerAuth"),
            import("@/server/publicRoomApi"),
          ]);
          return await handlePublicRoomRequest(
            request,
            getDeveloperEnv(),
            developerAuth(),
          );
        } catch {
          return Response.json(
            {
              error: {
                code: "service_unavailable",
                message: "Room creation is temporarily unavailable.",
              },
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
