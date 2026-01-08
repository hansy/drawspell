import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLoadDeckController } from "../useLoadDeckController";
import { useGameStore } from "@/store/gameStore";
import { ensureLocalStorage } from "@/store/testUtils";
import {
  acquireSession,
  destroySession,
  setActiveSession,
  setSessionProvider,
} from "@/yjs/docManager";
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
import { ZONE } from "@/constants/zones";
import * as deckImport from "@/services/deck-import/deckImport";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useLoadDeckController (command log)", () => {
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
    vi.restoreAllMocks();
  });

  it("imports library cards without being cleared by a shuffle command", async () => {
    sessionId = "cmdlog-load-deck";
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
    setSessionProvider(sessionId, {
      wsconnected: true,
      disconnect: vi.fn(),
      destroy: vi.fn(),
    } as any);

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
          deckLoaded: false,
        },
      },
    });

    const fetchSpy = vi
      .spyOn(deckImport, "fetchScryfallCards")
      .mockResolvedValue({
        cards: [{ name: "Swamp", section: "main" }],
        missing: [],
        warnings: [],
      });

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useLoadDeckController({ isOpen: true, onClose, playerId })
    );

    act(() => {
      result.current.handleImportTextChange("1 Swamp");
    });

    await act(async () => {
      await result.current.handleImport();
    });

    await waitFor(() => {
      expect(handles.commands.length).toBeGreaterThan(1);
    });

    fetchSpy.mockRestore();

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

    const libraryId = `${playerId}-${ZONE.LIBRARY}`;
    expect(state.zones[libraryId]?.cardIds).toHaveLength(1);
  });
});
