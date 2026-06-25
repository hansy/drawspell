import { afterEach, describe, expect, it } from "vitest";

import { createSafeStorage } from "../safeStorage";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  }
});

describe("createSafeStorage", () => {
  it("falls back to memory storage when localStorage is inaccessible", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    const storage = createSafeStorage();

    storage.setItem("key", "value");
    expect(storage.getItem("key")).toBe("value");
    expect(storage.length).toBe(1);

    storage.removeItem("key");
    expect(storage.getItem("key")).toBeNull();
  });
});
