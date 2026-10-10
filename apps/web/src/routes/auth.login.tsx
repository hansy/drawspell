import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/landing/SiteLayout";
export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});
function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <SiteLayout>
      <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100 space-y-6">
        <h1 className="text-3xl font-semibold">Sign in to Drawspell</h1>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch("/api/auth/sign-in/magic-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  callbackURL: "/developers",
                  newUserCallbackURL: "/developers",
                  errorCallbackURL: "/auth/login",
                }),
              });
              setMessage(
                response.ok
                  ? "Check your email for a sign-in link. It expires in ten minutes."
                  : "Unable to send a sign-in link. Please try again later.",
              );
            } catch {
              setMessage(
                "Unable to send a sign-in link. Please try again later.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            Email
            <input
              className="block w-full rounded border border-zinc-700 bg-zinc-900 p-3 mt-2"
              disabled={!ready}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            className="rounded bg-indigo-600 px-4 py-3 disabled:opacity-50"
            disabled={!ready || busy}
          >
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
        <p role="status">{message}</p>
      </main>
    </SiteLayout>
  );
}
