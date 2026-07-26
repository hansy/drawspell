import { afterEach, describe, expect, it, vi } from "vitest";
import { ORIGINS } from "@mtg/shared/constants/hosts";
import {
  createBenchmarkWebSocket,
  resolveBenchmarkOrigin,
  resolveBenchmarkRoom,
} from "../wsLoadConfig";

describe("Commander WebSocket load configuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an isolated room when no room or pre-issued token is supplied", () => {
    expect(
      resolveBenchmarkRoom({
        requestedRoom: null,
        suppliedJoinToken: null,
        createRoomId: () => "bench-unique",
      }),
    ).toBe("bench-unique");
  });

  it("requires the matching room when a pre-issued token is supplied", () => {
    expect(() =>
      resolveBenchmarkRoom({
        requestedRoom: null,
        suppliedJoinToken: "pre-issued-token",
      }),
    ).toThrow("--room is required when --joinToken is supplied");

    expect(
      resolveBenchmarkRoom({
        requestedRoom: "token-room",
        suppliedJoinToken: "pre-issued-token",
      }),
    ).toBe("token-room");
  });

  it("infers protected web origins from known server hosts", () => {
    expect(
      resolveBenchmarkOrigin(
        "wss://staging.ws.drawspell.space/parties/rooms/bench",
        null,
      ),
    ).toBe(ORIGINS.staging.web);
    expect(
      resolveBenchmarkOrigin(
        "wss://ws.drawspell.space/parties/rooms/bench",
        null,
      ),
    ).toBe(ORIGINS.production.web);
  });

  it("uses the configured Origin header for benchmark sockets", () => {
    const constructor = vi.fn();
    vi.stubGlobal("WebSocket", constructor);

    createBenchmarkWebSocket("wss://example.com/socket", "https://drawspell.space");

    expect(constructor).toHaveBeenCalledWith("wss://example.com/socket", {
      headers: { Origin: "https://drawspell.space" },
    });
  });
});
