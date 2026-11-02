import { m } from "@/paraglide/messages.js";
import { createServerFn } from "@tanstack/react-start";

import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";

type LeaveRoomRequest = {
  roomId: string;
  playerId: string;
  leaveToken: string;
};

const origins = resolveOriginsForEnv(import.meta.env.VITE_ENV);
const leaveRoomValidator = (input: LeaveRoomRequest) => input;

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator(leaveRoomValidator)
  .handler(async (ctx): Promise<void> => {
    const roomId = ctx.data?.roomId?.trim();
    const playerId = ctx.data?.playerId?.trim();
    const leaveToken = ctx.data?.leaveToken?.trim();
    if (!roomId || !playerId || !leaveToken) {
      throw new Error(m.leave_room_missing_leave_room_credentials());
    }

    const response = await fetch(`${origins.server}/rooms/leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, playerId, leaveToken }),
    });
    if (!response.ok) {
      throw new Error(m.leave_room_leave_room_request_failed({ status: response.status }));
    }
  });
