import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { getLocale } from "@/paraglide/runtime.js";

// RPC URLs stay unprefixed while their error and response copy uses the caller's locale.
const functionLocale = createMiddleware({ type: "function" }).client(({ next }) =>
  next({ headers: { "X-Drawspell-Locale": getLocale() } }),
);

export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (context) => context.handlerType === "serverFn" })],
  functionMiddleware: [functionLocale],
}));
