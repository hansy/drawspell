import { localeHref } from "@/i18n/navigation";
import { m } from "@/paraglide/messages.js";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { SiteLayout } from "@/components/landing/SiteLayout";
export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <SiteLayout>
      <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100 space-y-6">
        <h1 className="text-3xl font-semibold">{m.auth_login_sign_in_to_drawspell()}</h1>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!ready || busy) return;
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch("/api/auth/sign-in/magic-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  callbackURL: localeHref("/developers"),
                  newUserCallbackURL: localeHref("/developers"),
                  errorCallbackURL: localeHref("/auth/login"),
                }),
              });
              setMessage(
                response.ok
                  ? m.auth_login_check_your_email_for_a_sign_in_link_it_expires_in_ten_minutes()
                  : m.auth_login_unable_to_send_a_sign_in_link_please_try_again_later(),
              );
            } catch {
              setMessage(
                m.auth_login_unable_to_send_a_sign_in_link_please_try_again_later(),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            {m.auth_login_email()}<input
              className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-900 p-3 transition-colors duration-200 disabled:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
              disabled={!ready || busy}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="inline-grid min-h-12 min-w-48 place-items-center rounded bg-indigo-600 px-4 py-3 text-sm font-medium transition-colors duration-200 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/60 disabled:text-indigo-100/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 motion-reduce:transition-none"
            disabled={!ready || busy}
            aria-busy={busy}
            aria-label={busy ? m.auth_login_sending_sign_in_link() : m.auth_login_send_sign_in_link()}
          >
            <span aria-hidden="true" className={`col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none ${busy ? "opacity-0" : "opacity-100"}`}>
              {m.auth_login_send_sign_in_link()}</span>
            <span aria-hidden="true" className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none ${busy ? "opacity-100" : "opacity-0"}`}>
              <LoaderCircle size={16} className={busy ? "animate-spin motion-reduce:animate-none" : undefined} />
              {m.auth_login_sending()}</span>
          </button>
        </form>
        <p role="status" className="min-h-6 text-sm text-zinc-400">{message}</p>
      </main>
    </SiteLayout>
  );
}
