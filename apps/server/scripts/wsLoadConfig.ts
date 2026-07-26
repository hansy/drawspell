import { ORIGINS } from "@mtg/shared/constants/hosts";

export const resolveBenchmarkRoom = ({
  requestedRoom,
  suppliedJoinToken,
  createRoomId = () => `bench-${crypto.randomUUID()}`,
}: {
  requestedRoom: string | null;
  suppliedJoinToken: string | null;
  createRoomId?: () => string;
}) => {
  if (suppliedJoinToken && !requestedRoom) {
    throw new Error("--room is required when --joinToken is supplied");
  }
  return requestedRoom ?? createRoomId();
};

export const resolveBenchmarkOrigin = (
  rawUrl: string,
  explicitOrigin: string | null,
) => {
  if (explicitOrigin) return new URL(explicitOrigin).origin;
  const serverHost = new URL(rawUrl).host;
  return (
    Object.values(ORIGINS).find(
      ({ server }) => new URL(server).host === serverHost,
    )?.web ?? null
  );
};

export const createBenchmarkWebSocket = (
  url: string,
  origin: string | null,
) => {
  // Bun extends the browser constructor with request headers, while TypeScript's
  // DOM declaration only exposes the browser protocol overload.
  const BunWebSocket = WebSocket as unknown as new (
    url: string,
    options?: { headers: Record<string, string> },
  ) => WebSocket;
  return new BunWebSocket(
    url,
    origin
      ? {
          headers: { Origin: origin },
        }
      : undefined,
  );
};
