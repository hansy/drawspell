import { base64UrlToBytes, bytesToBase64Url } from "@/crypto/base64url";
import { generateEd25519KeyPair } from "@/crypto/ed25519";
import { sha256Bytes } from "@/crypto/hash";
import { bytesToHex } from "@/crypto/hex";
import { randomBytes } from "@/crypto/random";
import { generateX25519KeyPair } from "@/crypto/x25519";
import { createSafeStorage } from "@/lib/safeStorage";

export type SessionIdentity = {
  v: 1;
  playerId: string;
  signPublicKey: string;
  signPrivateKey: string;
  encPublicKey: string;
  encPrivateKey: string;
  ownerKey: string;
};

export type SessionIdentityBytes = {
  playerId: string;
  signPublicKey: Uint8Array;
  signPrivateKey: Uint8Array;
  encPublicKey: Uint8Array;
  encPrivateKey: Uint8Array;
  ownerKey: Uint8Array;
};

const STORAGE_PREFIX = "mtg:session-identity:";
const STORAGE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidIdentity = (value: unknown): value is SessionIdentity => {
  if (!isRecord(value)) return false;
  if (value.v !== STORAGE_VERSION) return false;
  return (
    typeof value.playerId === "string" &&
    typeof value.signPublicKey === "string" &&
    typeof value.signPrivateKey === "string" &&
    typeof value.encPublicKey === "string" &&
    typeof value.encPrivateKey === "string" &&
    typeof value.ownerKey === "string"
  );
};

const storageKeyForSession = (sessionId: string) => `${STORAGE_PREFIX}${sessionId}`;

const derivePlayerId = (signPublicKey: Uint8Array): string => {
  const digest = sha256Bytes(signPublicKey);
  return bytesToHex(digest.slice(0, 16));
};

export const loadSessionIdentity = (
  sessionId: string,
  storage: Storage = createSafeStorage(),
): SessionIdentity | null => {
  try {
    const raw = storage.getItem(storageKeyForSession(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidIdentity(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
};

export const getOrCreateSessionIdentity = (
  sessionId: string,
  storage: Storage = createSafeStorage(),
): SessionIdentity => {
  const existing = loadSessionIdentity(sessionId, storage);
  if (existing) return existing;

  const signing = generateEd25519KeyPair();
  const encryption = generateX25519KeyPair();
  const playerId = derivePlayerId(signing.publicKey);
  const ownerKey = bytesToBase64Url(randomBytes(32));

  const identity: SessionIdentity = {
    v: STORAGE_VERSION,
    playerId,
    signPublicKey: bytesToBase64Url(signing.publicKey),
    signPrivateKey: bytesToBase64Url(signing.privateKey),
    encPublicKey: bytesToBase64Url(encryption.publicKey),
    encPrivateKey: bytesToBase64Url(encryption.privateKey),
    ownerKey,
  };

  try {
    storage.setItem(storageKeyForSession(sessionId), JSON.stringify(identity));
  } catch (_err) {
    // Ignore storage failures and return the in-memory identity.
  }

  return identity;
};

export const getSessionIdentityBytes = (
  sessionId: string,
  storage: Storage = createSafeStorage(),
): SessionIdentityBytes => {
  const identity = getOrCreateSessionIdentity(sessionId, storage);
  return {
    playerId: identity.playerId,
    signPublicKey: base64UrlToBytes(identity.signPublicKey),
    signPrivateKey: base64UrlToBytes(identity.signPrivateKey),
    encPublicKey: base64UrlToBytes(identity.encPublicKey),
    encPrivateKey: base64UrlToBytes(identity.encPrivateKey),
    ownerKey: base64UrlToBytes(identity.ownerKey),
  };
};

export const deleteSessionIdentity = (
  sessionId: string,
  storage: Storage = createSafeStorage(),
): void => {
  try {
    storage.removeItem(storageKeyForSession(sessionId));
  } catch (_err) {
    // Ignore storage errors.
  }
};

export const SESSION_IDENTITY_STORAGE_PREFIX = STORAGE_PREFIX;
