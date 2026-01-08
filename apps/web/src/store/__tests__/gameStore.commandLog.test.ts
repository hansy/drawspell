import { beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";

import { useGameStore } from "../gameStore";
import { ZONE } from "@/constants/zones";
import { ensureLocalStorage } from "../testUtils";
import { acquireSession, destroySession, setActiveSession } from "@/yjs/docManager";
import { ensureSessionAccessKeys, getSessionAccessKeys } from "@/lib/sessionKeys";
import { getSessionIdentityBytes } from "@/lib/sessionIdentity";
import { appendCommand } from "@/commandLog/commands";
import type { CommandEnvelope } from "@/commandLog/types";
import {
  applyCommandLog,
  createCommandLogContext,
  createCommandLogMeta,
  createEmptyCommandLogState,
} from "@/commandLog/replay";
import { base64UrlToBytes, bytesToBase64Url } from "@/crypto/base64url";

describe("gameStore command log interactions", () => {
  let sessionId: string | null = null;

  beforeAll(() => {
    ensureLocalStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      cards: {},
      zones: {},
      players: {},
      myPlayerId: "me",
      viewerRole: "player",
    });
  });

  afterEach(() => {
    if (sessionId) {
      destroySession(sessionId);
      sessionId = null;
    }
    setActiveSession(null);
  });

  it("keeps a card visible when moving from a public zone into hand", async () => {
    sessionId = "cmdlog-move-hand";
    ensureSessionAccessKeys(sessionId);
    const identity = getSessionIdentityBytes(sessionId);
    const playerId = identity.playerId;
    const keys = getSessionAccessKeys(sessionId);
    if (!keys.playerKey) {
      throw new Error("Missing player key for command log test");
    }
    const playerKey = base64UrlToBytes(keys.playerKey);

    const handles = acquireSession(sessionId);
    setActiveSession(sessionId);

    appendCommand({
      commands: handles.commands,
      sessionId,
      playerKey,
      signPrivateKey: identity.signPrivateKey,
      envelope: {
        v: 1,
        id: "cmd-join",
        actorId: playerId,
        seq: 1,
        ts: 1,
        type: "player.join",
        payloadPublic: { playerId, name: "Player" },
        pubKey: bytesToBase64Url(identity.signPublicKey),
      },
    });

    const commanderId = `${playerId}-${ZONE.COMMANDER}`;
    const handId = `${playerId}-${ZONE.HAND}`;
    const cardId = "card-1";

    appendCommand({
      commands: handles.commands,
      sessionId,
      playerKey,
      signPrivateKey: identity.signPrivateKey,
      envelope: {
        v: 1,
        id: "cmd-card",
        actorId: playerId,
        seq: 2,
        ts: 2,
        type: "card.create.public",
        payloadPublic: {
          card: {
            id: cardId,
            ownerId: playerId,
            controllerId: playerId,
            zoneId: commanderId,
            name: "Commander",
            tapped: false,
            faceDown: false,
            position: { x: 0, y: 0 },
            rotation: 0,
            counters: [],
          },
        },
        pubKey: bytesToBase64Url(identity.signPublicKey),
      },
    });

    useGameStore.setState({
      myPlayerId: playerId,
      viewerRole: "player",
      players: {
        [playerId]: {
          id: playerId,
          name: "Player",
          life: 40,
          counters: [],
          commanderDamage: {},
          commanderTax: 0,
          deckLoaded: true,
        },
      },
      zones: {
        [commanderId]: {
          id: commanderId,
          type: ZONE.COMMANDER,
          ownerId: playerId,
          cardIds: [cardId],
        },
        [handId]: {
          id: handId,
          type: ZONE.HAND,
          ownerId: playerId,
          cardIds: [],
        },
      },
      cards: {
        [cardId]: {
          id: cardId,
          name: "Commander",
          ownerId: playerId,
          controllerId: playerId,
          zoneId: commanderId,
          tapped: false,
          faceDown: false,
          position: { x: 0, y: 0 },
          rotation: 0,
          counters: [],
        },
      },
    });

    useGameStore.getState().moveCard(cardId, handId, undefined, playerId);

    await waitFor(() => {
      expect(handles.commands.length).toBeGreaterThan(2);
    });

    const ctx = createCommandLogContext({
      sessionId,
      viewerId: playerId,
      viewerRole: "player",
    });
    let state = createEmptyCommandLogState();
    let meta = createCommandLogMeta();
    for (let i = 0; i < handles.commands.length; i += 1) {
      const envelope = handles.commands.get(i) as CommandEnvelope;
      const result = await applyCommandLog({ state, meta, envelope, ctx });
      state = result.state;
      meta = result.meta;
    }

    const handZone = state.zones[handId];
    expect(handZone?.cardIds).toHaveLength(1);
    const movedId = handZone?.cardIds[0];
    expect(movedId).not.toBe(cardId);
    expect(state.cards[cardId]).toBeUndefined();
    expect(state.cards[movedId ?? ""]).toBeDefined();
  });
});
