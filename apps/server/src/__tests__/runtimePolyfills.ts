import { Buffer } from "node:buffer";
import { webcrypto } from "node:crypto";

type RuntimePolyfillOptions = {
  base64?: boolean;
};

const ensureWebCrypto = () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto });
  }
};

const ensureBase64 = () => {
  if (typeof globalThis.btoa !== "function") {
    globalThis.btoa = (input: string) =>
      Buffer.from(input, "binary").toString("base64");
  }
  if (typeof globalThis.atob !== "function") {
    globalThis.atob = (input: string) =>
      Buffer.from(input, "base64").toString("binary");
  }
};

export const ensureRuntimePolyfills = (
  options: RuntimePolyfillOptions = {},
) => {
  ensureWebCrypto();
  if (options.base64) {
    ensureBase64();
  }
};
