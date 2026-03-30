import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createJoinToken } from "@mtg/shared/security/joinToken";
import { ensureRuntimePolyfills } from "./runtimePolyfills";

const mocks = vi.hoisted(() => ({
  routePartykitRequest: vi.fn(async () => new Response("upgraded", { status: 200 })),
}));

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: any;
    storage: any;
    constructor(ctx: any, _env: any) {
      this.ctx = ctx;
      this.storage = ctx.storage;
    }
  },
  DurableObjectNamespace: class {},
}));

vi.mock("partyserver", () => ({
  routePartykitRequest: mocks.routePartykitRequest,
}));

vi.mock("y-partyserver", () => ({
  YServer: class {
    ctx: any;
    env: any;
    name: string;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
      this.name = ctx?.id?.name ?? "room-test";
    }
  },
}));

import server from "../server";

beforeAll(() => {
  ensureRuntimePolyfills({ base64: true });
});

describe("party websocket handshake allowlist", () => {
  beforeEach(() => {
    mocks.routePartykitRequest.mockClear();
  });

  it("rejects workers.dev preview origins by default", async () => {
    const joinToken = await createJoinToken(
      { roomId: "room-preview", exp: Date.now() + 60_000 },
      "join-secret",
    );

    const response = await server.fetch(
      new Request(
        `https://drawspell-server-preview.workers.dev/parties/rooms/room-preview?jt=${encodeURIComponent(joinToken)}`,
        {
          headers: {
            Upgrade: "websocket",
            Origin: "https://drawspell-pr-branch.workers.dev",
            Host: "drawspell-server-preview.workers.dev",
          },
        },
      ),
      {
        JOIN_TOKEN_SECRET: "join-secret",
        NODE_ENV: "staging",
      } as any,
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Origin not allowed");
    expect(mocks.routePartykitRequest).not.toHaveBeenCalled();
  });

});
