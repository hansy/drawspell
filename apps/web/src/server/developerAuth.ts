import { readLocalePath } from "@/i18n/urls";
import { m } from "@/paraglide/messages.js";
import { env } from "cloudflare:workers";
import { createAuth, handleAuthRequest } from "@mtg/auth";
import type { DeveloperEnv } from "./developerEnv";
export const getDeveloperEnv = () => env as unknown as DeveloperEnv;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export function developerAuth(bindings = getDeveloperEnv()) {
  return createAuth({
    db: bindings.DB,
    secret: bindings.BETTER_AUTH_SECRET,
    baseURL: bindings.AUTH_URL,
    sendMagicLink: async ({ email, url }) => {
      if (import.meta.env.DEV && bindings.AUTH_TEST_SECRET) {
        await bindings.DB.exec(
          "CREATE TABLE IF NOT EXISTS developer_test_mail (email TEXT PRIMARY KEY, url TEXT NOT NULL, sent_at INTEGER NOT NULL)",
        );
        await bindings.DB.prepare(
          "INSERT INTO developer_test_mail VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET url=excluded.url, sent_at=excluded.sent_at",
        )
          .bind(email, url, Date.now())
          .run();
        return;
      }
      const callback = new URL(url).searchParams.get("callbackURL");
      const locale = readLocalePath(new URL(callback || "/", bindings.AUTH_URL).pathname).locale;
      const text = m.developer_auth_sign_in_to_drawspell_this_link_expires_in_10_minutes_if_you_did_n({ url }, { locale });
      await bindings.EMAIL.send({
        from: { email: bindings.EMAIL_FROM, name: "Drawspell" },
        to: email,
        subject: m.auth_login_sign_in_to_drawspell({}, { locale }),
        text,
        html: `<pre>${escapeHtml(text)}</pre>`,
      });
    },
  });
}
export async function developerAuthHandler(request: Request) {
  try {
    const bindings = getDeveloperEnv();
    const response = await handleAuthRequest(developerAuth(bindings), request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json(
      {
        error: {
          code: "server_error",
          message: m.developer_auth_authentication_is_temporarily_unavailable(),
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
