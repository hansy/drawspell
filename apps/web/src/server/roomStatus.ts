import { m } from "@/paraglide/messages.js";
import { createServerFn } from "@tanstack/react-start";
import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";

type RoomStatusRequest = {
  roomId: string;
  accessToken: string;
};

type RoomStatusResponse = {
  exists: boolean;
  hostName?: string | null;
  playerCount?: number;
};

const origins = resolveOriginsForEnv(import.meta.env.VITE_ENV);
const roomStatusValidator = (input: RoomStatusRequest) => input;

export const getRoomStatus = createServerFn({ method: "POST" })
  .inputValidator(roomStatusValidator)
  .handler(async (ctx): Promise<RoomStatusResponse> => {
    const roomId = ctx.data?.roomId?.trim();
    const accessToken = ctx.data?.accessToken?.trim();
    if (!roomId || !accessToken) {
      throw new Error(m.room_status_missing_room_status_credentials());
    }

    const response = await fetch(`${origins.server}/rooms/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, accessToken }),
    });
    if (!response.ok) {
      throw new Error(m.room_status_room_status_request_failed({ status: response.status }));
    }
    const result = (await response.json()) as Partial<RoomStatusResponse>;
    if (typeof result.exists !== "boolean") {
      throw new Error(m.room_status_invalid_room_status_response());
    }
    return {
      exists: result.exists,
      hostName: typeof result.hostName === "string" ? result.hostName : null,
      playerCount: typeof result.playerCount === "number" ? result.playerCount : undefined,
    };
  });
