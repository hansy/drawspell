export const createSafeStorage = (): Storage => {
  const createMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
  };

  if (typeof window === "undefined") {
    return createMemoryStorage();
  }

  try {
    if (!window.localStorage) return createMemoryStorage();
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
};
