import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameStoreStorage, createSafeStorage } from "../safeStorage";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  }
});

const createStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
};

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

describe("createGameStoreStorage", () => {
  it("skips consecutive writes when the persisted identity state is unchanged", () => {
    const backing = createStorage();
    const setItem = vi.spyOn(backing, "setItem");
    const storage = createGameStoreStorage(backing);

    storage.setItem("drawspell-storage", '{"state":{"sessionVersions":{}},"version":2}');
    storage.setItem("drawspell-storage", '{"state":{"sessionVersions":{}},"version":2}');

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("writes again after the persisted value changes or is removed", () => {
    const backing = createStorage();
    const setItem = vi.spyOn(backing, "setItem");
    const storage = createGameStoreStorage(backing);

    storage.setItem("drawspell-storage", "one");
    storage.setItem("drawspell-storage", "two");
    storage.removeItem("drawspell-storage");
    storage.setItem("drawspell-storage", "two");

    expect(setItem).toHaveBeenCalledTimes(3);
  });

  it("seeds its comparison cache when hydration reads an existing value", () => {
    const backing = createStorage();
    backing.setItem("drawspell-storage", "existing");
    const setItem = vi.spyOn(backing, "setItem");
    const storage = createGameStoreStorage(backing);

    expect(storage.getItem("drawspell-storage")).toBe("existing");
    storage.setItem("drawspell-storage", "existing");

    expect(setItem).not.toHaveBeenCalled();
  });
});
