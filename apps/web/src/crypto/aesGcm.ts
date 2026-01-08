import { base64UrlToBytes, bytesToBase64Url } from "./base64url";
import { concatBytes, toBytes } from "./bytes";
import { randomBytes } from "./random";

const AES_GCM_NONCE_LENGTH = 12;

const getCrypto = (): Crypto => {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error("WebCrypto is not available in this environment");
  }
  return cryptoObj;
};

const importAesKey = async (key: Uint8Array, usage: "encrypt" | "decrypt") => {
  return getCrypto().subtle.importKey(
    "raw",
    asBufferSource(key)!,
    { name: "AES-GCM" },
    false,
    [usage],
  );
};

const asBufferSource = (value?: Uint8Array): BufferSource | undefined =>
  value ? (value as unknown as BufferSource) : undefined;

export const aesGcmEncrypt = async (params: {
  key: Uint8Array;
  plaintext: Uint8Array | string;
  nonce?: Uint8Array;
  aad?: Uint8Array;
}): Promise<string> => {
  const nonce = params.nonce ?? randomBytes(AES_GCM_NONCE_LENGTH);
  if (nonce.length !== AES_GCM_NONCE_LENGTH) {
    throw new Error("AES-GCM nonce must be 12 bytes");
  }

  const cryptoKey = await importAesKey(params.key, "encrypt");
  const algorithm: AesGcmParams = {
    name: "AES-GCM",
    iv: asBufferSource(nonce)!,
  };
  if (params.aad) {
    algorithm.additionalData = asBufferSource(params.aad)!;
  }
  const ciphertext = await getCrypto().subtle.encrypt(
    algorithm,
    cryptoKey,
    asBufferSource(toBytes(params.plaintext))!,
  );

  return bytesToBase64Url(concatBytes(nonce, new Uint8Array(ciphertext)));
};

export const aesGcmDecrypt = async (params: {
  key: Uint8Array;
  ciphertext: string;
  aad?: Uint8Array;
}): Promise<Uint8Array> => {
  const data = base64UrlToBytes(params.ciphertext);
  if (data.length <= AES_GCM_NONCE_LENGTH) {
    throw new Error("AES-GCM ciphertext payload is too short");
  }

  const nonce = data.slice(0, AES_GCM_NONCE_LENGTH);
  const ciphertext = data.slice(AES_GCM_NONCE_LENGTH);
  const cryptoKey = await importAesKey(params.key, "decrypt");

  const algorithm: AesGcmParams = {
    name: "AES-GCM",
    iv: asBufferSource(nonce)!,
  };
  if (params.aad) {
    algorithm.additionalData = asBufferSource(params.aad)!;
  }
  const plaintext = await getCrypto().subtle.decrypt(
    algorithm,
    cryptoKey,
    asBufferSource(ciphertext)!,
  );

  return new Uint8Array(plaintext);
};
