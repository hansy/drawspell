import { m } from "@/paraglide/messages.js";
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
                message: m.api_v1_rooms_room_creation_is_temporarily_unavailable(),
              },
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
