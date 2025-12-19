export const CLIENT_KEY_STORAGE = "mtg:client-key";

export const genUuidLike = (rng: () => number = Math.random) => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (rng() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getOrCreateClientKey = (params: {
  storage: Pick<Storage, "getItem" | "setItem">;
  randomUUID?: () => string;
  storageKey?: string;
  rng?: () => number;
}): string => {
  const storageKey = params.storageKey ?? CLIENT_KEY_STORAGE;

  try {
    const existing = params.storage.getItem(storageKey);
    if (existing) return existing;

    const next =
      typeof params.randomUUID === "function"
        ? params.randomUUID()
        : genUuidLike(params.rng);

    params.storage.setItem(storageKey, next);
    return next;
  } catch (_err) {
    return genUuidLike(params.rng);
  }
};

