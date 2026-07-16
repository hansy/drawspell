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

export const createGameStoreStorage = (storage: Storage = createSafeStorage()): Storage => {
  const lastValues = new Map<string, string>();

  return {
    getItem: (key) => {
      const value = storage.getItem(key);
      if (value === null) {
        lastValues.delete(key);
      } else {
        lastValues.set(key, value);
      }
      return value;
    },
    setItem: (key, value) => {
      if (lastValues.get(key) === value) return;
      storage.setItem(key, value);
      lastValues.set(key, value);
    },
    removeItem: (key) => {
      storage.removeItem(key);
      lastValues.delete(key);
    },
    clear: () => {
      storage.clear();
      lastValues.clear();
    },
    key: (index) => storage.key(index),
    get length() {
      return storage.length;
    },
  };
};
