import { webcrypto } from "crypto";

if (!globalThis.crypto?.subtle) {
  // Ensure WebCrypto is available for crypto unit tests in Node.
  globalThis.crypto = webcrypto as Crypto;
}
