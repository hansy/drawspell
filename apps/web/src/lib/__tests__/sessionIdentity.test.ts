import { describe, expect, it } from "vitest";

import { createMemoryStorage } from "@/store/testUtils";
import {
  deleteSessionIdentity,
  getOrCreateSessionIdentity,
  loadSessionIdentity,
} from "@/lib/sessionIdentity";

describe("sessionIdentity", () => {
  it("returns a stable identity per session", () => {
    const storage = createMemoryStorage();
    const first = getOrCreateSessionIdentity("s1", storage);
    const second = getOrCreateSessionIdentity("s1", storage);

    expect(second.playerId).toBe(first.playerId);
    expect(second.signPublicKey).toBe(first.signPublicKey);
    expect(second.encPublicKey).toBe(first.encPublicKey);
    expect(second.ownerKey).toBe(first.ownerKey);
  });

  it("deletes stored identities", () => {
    const storage = createMemoryStorage();
    getOrCreateSessionIdentity("s2", storage);

    deleteSessionIdentity("s2", storage);

    expect(loadSessionIdentity("s2", storage)).toBeNull();
  });
});
