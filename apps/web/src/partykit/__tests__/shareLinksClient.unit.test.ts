import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSendPartyMessage = vi.hoisted(() => vi.fn());

vi.mock("../intentTransport", () => ({
  sendPartyMessage: mockSendPartyMessage,
}));

vi.mock("uuid", () => ({
  v4: () => "request-1",
}));

import {
  handleShareLinksResponse,
  isAbortedShareLinksRequest,
  requestShareLinks,
  resetShareLinksRequestsForTests,
} from "../shareLinksClient";

describe("shareLinksClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSendPartyMessage.mockReset();
    resetShareLinksRequestsForTests();
  });

  afterEach(() => {
    resetShareLinksRequestsForTests();
    vi.useRealTimers();
  });

  it("requests share links and resolves the matching response", async () => {
    mockSendPartyMessage.mockReturnValue(true);

    const promise = requestShareLinks();

    expect(mockSendPartyMessage).toHaveBeenCalledWith({
      type: "shareLinksRequest",
      requestId: "request-1",
    });

    handleShareLinksResponse({
      type: "shareLinksResponse",
      requestId: "request-1",
      ok: true,
      payload: {
        playerInviteUrl: "https://example.com/rooms/room-1?gt=player",
        spectatorInviteUrl: "https://example.com/rooms/room-1?st=spectator",
        resumeInviteUrl: "https://example.com/rooms/room-1?rt=resume&playerId=p1",
      },
    });

    await expect(promise).resolves.toEqual({
      playerInviteUrl: "https://example.com/rooms/room-1?gt=player",
      spectatorInviteUrl: "https://example.com/rooms/room-1?st=spectator",
      resumeInviteUrl: "https://example.com/rooms/room-1?rt=resume&playerId=p1",
    });
  });

  it("retries until the transport accepts the request", async () => {
    mockSendPartyMessage
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    const promise = requestShareLinks({
      retryIntervalMs: 100,
      timeoutMs: 1_000,
    });

    expect(mockSendPartyMessage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendPartyMessage).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendPartyMessage).toHaveBeenCalledTimes(3);

    handleShareLinksResponse({
      type: "shareLinksResponse",
      requestId: "request-1",
      ok: true,
      payload: {
        playerInviteUrl: "player",
        spectatorInviteUrl: "spectator",
      },
    });

    await expect(promise).resolves.toEqual({
      playerInviteUrl: "player",
      spectatorInviteUrl: "spectator",
    });
  });

  it("times out when the transport never opens", async () => {
    mockSendPartyMessage.mockReturnValue(false);

    const promise = requestShareLinks({
      retryIntervalMs: 50,
      timeoutMs: 200,
    });
    const rejection = expect(promise).rejects.toThrow("Unable to load invite links.");

    await vi.advanceTimersByTimeAsync(200);

    await rejection;
  });

  it("supports aborting an in-flight request", async () => {
    mockSendPartyMessage.mockReturnValue(false);
    const abortController = new AbortController();

    const promise = requestShareLinks({
      signal: abortController.signal,
      timeoutMs: 1_000,
    });

    abortController.abort();

    try {
      await promise;
      throw new Error("Expected request to abort");
    } catch (error) {
      expect(isAbortedShareLinksRequest(error)).toBe(true);
    }
  });
});
