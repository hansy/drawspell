import { aesGcmDecrypt, aesGcmEncrypt } from "@/crypto/aesGcm";
import { base64UrlToBytes, bytesToBase64Url } from "@/crypto/base64url";
import { bytesToUtf8, concatBytes, utf8ToBytes } from "@/crypto/bytes";
import { hkdfSha256 } from "@/crypto/hash";
import { x25519SharedSecret } from "@/crypto/x25519";

import type { RecipientEncryptedPayload } from "./types";

const OWNER_INFO = "owner-aes";
const SPECTATOR_INFO = "spectator-aes";
const REVEAL_INFO = "reveal";
const AES_KEY_LENGTH = 32;
const NONCE_LENGTH = 12;

export const deriveOwnerAesKey = (params: {
  ownerKey: Uint8Array;
  sessionId: string;
}): Uint8Array => {
  return hkdfSha256({
    ikm: params.ownerKey,
    salt: utf8ToBytes(params.sessionId),
    info: utf8ToBytes(OWNER_INFO),
    length: AES_KEY_LENGTH,
  });
};

export const deriveSpectatorAesKey = (params: {
  spectatorKey: Uint8Array;
  sessionId: string;
}): Uint8Array => {
  return hkdfSha256({
    ikm: params.spectatorKey,
    salt: utf8ToBytes(params.sessionId),
    info: utf8ToBytes(SPECTATOR_INFO),
    length: AES_KEY_LENGTH,
  });
};

export const deriveRevealAesKey = (params: {
  sharedSecret: Uint8Array;
  sessionId: string;
}): Uint8Array => {
  return hkdfSha256({
    ikm: params.sharedSecret,
    salt: utf8ToBytes(params.sessionId),
    info: utf8ToBytes(REVEAL_INFO),
    length: AES_KEY_LENGTH,
  });
};

export const encryptJsonPayload = async (
  key: Uint8Array,
  payload: unknown,
): Promise<string> => {
  return aesGcmEncrypt({
    key,
    plaintext: JSON.stringify(payload),
  });
};

export const decryptJsonPayload = async (
  key: Uint8Array,
  ciphertext: string,
): Promise<unknown> => {
  const plaintext = await aesGcmDecrypt({ key, ciphertext });
  return JSON.parse(bytesToUtf8(plaintext));
};

export const encryptPayloadForRecipient = async (params: {
  payload: unknown;
  recipientPubKey: Uint8Array;
  ephemeralKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  sessionId: string;
}): Promise<RecipientEncryptedPayload> => {
  const sharedSecret = x25519SharedSecret(
    params.ephemeralKeyPair.privateKey,
    params.recipientPubKey,
  );
  const key = deriveRevealAesKey({
    sharedSecret,
    sessionId: params.sessionId,
  });
  const combined = await aesGcmEncrypt({
    key,
    plaintext: JSON.stringify(params.payload),
  });
  const bytes = base64UrlToBytes(combined);
  const nonce = bytes.slice(0, NONCE_LENGTH);
  const ct = bytes.slice(NONCE_LENGTH);
  return {
    epk: bytesToBase64Url(params.ephemeralKeyPair.publicKey),
    nonce: bytesToBase64Url(nonce),
    ct: bytesToBase64Url(ct),
  };
};

export const decryptPayloadForRecipient = async (params: {
  payload: RecipientEncryptedPayload;
  recipientPrivateKey: Uint8Array;
  sessionId: string;
}): Promise<unknown> => {
  const epkBytes = base64UrlToBytes(params.payload.epk);
  const sharedSecret = x25519SharedSecret(params.recipientPrivateKey, epkBytes);
  const key = deriveRevealAesKey({ sharedSecret, sessionId: params.sessionId });
  const nonce = base64UrlToBytes(params.payload.nonce);
  const ct = base64UrlToBytes(params.payload.ct);
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error("Invalid reveal nonce length");
  }
  const combined = bytesToBase64Url(concatBytes(nonce, ct));
  const plaintext = await aesGcmDecrypt({ key, ciphertext: combined });
  return JSON.parse(bytesToUtf8(plaintext));
};
