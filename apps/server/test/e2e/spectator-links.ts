import assert from "node:assert/strict";
import { createJoinToken } from "@mtg/shared/security/joinToken";
import type { CreateRoomResponse } from "@mtg/shared/api/rooms";

// Run against an isolated local Worker with matching fixture secrets:
// wrangler dev --local --port 8787 --persist-to /tmp/drawspell-spectator-test \
//   --var ROOM_PROVISION_SECRET:local-spectator-test --var JOIN_TOKEN_SECRET:local-join-test
const origin = process.env.ROOM_TEST_ORIGIN ?? "http://127.0.0.1:8787";
const provisionSecret = process.env.ROOM_TEST_PROVISION_SECRET ?? "local-spectator-test";
const joinSecret = process.env.ROOM_TEST_JOIN_SECRET ?? "local-join-test";
const sockets: WebSocket[] = [];

async function connect(roomId: string, channel: string, credentials: Record<string, string>) {
  const jt = await createJoinToken({ roomId, exp: Date.now() + 60_000 }, joinSecret);
  const url = new URL(`/parties/rooms/${roomId}`, origin.replace(/^http/, "ws"));
  url.search = new URLSearchParams({ role: channel, jt, ...credentials }).toString();
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages: Array<Record<string, unknown>> = [];
  const rawMessages: string[] = [];
  let closeCode: number | undefined;
  let frameCount = 0;
  socket.addEventListener("message", event => {
    frameCount++;
    if (typeof event.data === "string") {
      rawMessages.push(event.data);
      messages.push(JSON.parse(event.data));
    }
  });
  socket.addEventListener("close", event => { closeCode = event.code; });
  const waitFor = async (predicate: () => boolean, label: string) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  return { socket, messages, rawMessages, waitFor, closed: () => closeCode, frames: () => frameCount };
}

try {
  for (const displaySpectatorLink of [false, true]) {
    const roomId = crypto.randomUUID();
    const payload = { roomId, creationId: crypto.randomUUID(), activationExpiresAt: Date.now() + 600_000,
      request: { displaySpectatorLink, players: [{ externalId: "one" }] } };
    const provision = () => fetch(`${origin}/internal/rooms`, {
      method: "POST", headers: { Authorization: `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await provision();
    assert.equal(response.status, 200);
    const room: CreateRoomResponse = await response.json();
    assert.equal(room.displaySpectatorLink, displaySpectatorLink);
    const st = new URL(room.spectatorLink).searchParams.get("st");
    const gt = new URL(room.playerInviteUrl).searchParams.get("gt");
    assert(st && gt && st !== gt);
    const player = await connect(roomId, "intent", { gt, playerId: "one", viewerRole: "player" });
    await player.waitFor(() => player.messages.some(message => message.type === "roomTokens"), "player credentials");
    player.socket.send(JSON.stringify({ type: "shareLinksRequest", requestId: "smoke-share" }));
    await player.waitFor(() => player.messages.some(message => message.type === "shareLinksResponse"), "share links");
    const share = player.messages.find(message => message.type === "shareLinksResponse");
    const tokens = player.messages.find(message => message.type === "roomTokens");
    assert(share && tokens);
    assert.equal(share.ok, true);
    if (!displaySpectatorLink) {
      assert(!JSON.stringify(player.messages).includes(st));
      assert(!JSON.stringify(share).includes("spectatorLink"));
      assert(!JSON.stringify(tokens).includes("spectatorToken"));
    } else {
      assert(JSON.stringify(share).includes(st));
      assert(JSON.stringify(tokens).includes(st));
    }
    for (const channel of ["sync", "intent"]) {
      const spectator = await connect(roomId, channel, { st, viewerRole: "spectator", invite: new URL(room.players[0]!.joinUrl).searchParams.get("invite")!, rt: "cached-player-resume", playerId: "one" });
      await spectator.waitFor(() => spectator.frames() > 0 || spectator.closed() !== undefined, "spectator connection");
      assert.equal(spectator.closed(), undefined);
      for (const credentials of [
        { gt, viewerRole: "spectator", playerId: "forged" },
        { st: gt, viewerRole: "spectator", playerId: "forged" },
        { invite: new URL(room.players[0]!.joinUrl).searchParams.get("invite")!, viewerRole: "spectator", playerId: "forged" },
      ]) {
        const forged = await connect(roomId, channel, credentials);
        await forged.waitFor(() => forged.closed() !== undefined, "forged spectator rejection");
        assert.equal(forged.closed(), 1008);
        assert.equal(forged.frames(), 0);
      }
    }
    assert.deepEqual(await (await provision()).json(), room);
    console.log(`PASS displaySpectatorLink=${displaySpectatorLink}: API link, player disclosure, both spectator channels, credential substitution, stable replay`);
  }
} finally {
  sockets.forEach(socket => socket.close());
}
