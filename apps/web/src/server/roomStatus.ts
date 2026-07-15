import { createServerFn } from "@tanstack/react-start";
import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";

type RoomStatusRequest = {
  roomId: string;
  accessToken: string;
};

type RoomStatusResponse = {
  exists: boolean;
};

const origins = resolveOriginsForEnv(import.meta.env.VITE_ENV);
const roomStatusValidator = (input: RoomStatusRequest) => input;

export const getRoomStatus = createServerFn({ method: "POST" })
  .inputValidator(roomStatusValidator)
  .handler(async (ctx): Promise<RoomStatusResponse> => {
    const roomId = ctx.data?.roomId?.trim();
    const accessToken = ctx.data?.accessToken?.trim();
    if (!roomId || !accessToken) {
      throw new Error("missing room status credentials");
    }

    const response = await fetch(`${origins.server}/rooms/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, accessToken }),
    });
    if (!response.ok) {
      throw new Error(`room status request failed (${response.status})`);
    }
    const result = (await response.json()) as Partial<RoomStatusResponse>;
    if (typeof result.exists !== "boolean") {
      throw new Error("invalid room status response");
    }
    return { exists: result.exists };
  });
