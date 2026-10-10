import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/landing/SiteLayout";
import {
  getDeveloperDashboard,
  developerResponseStatus,
} from "@/server/developerDashboard";

export const Route = createFileRoute("/developers")({
  ssr: true,
  staleTime: 0,
  gcTime: 0,
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") !== "/developers")
      throw notFound();
  },
  loader: () => getDeveloperDashboard(),
  server: { middleware: [developerResponseStatus] },
  headers: () => ({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const data = Route.useLoaderData();
  return (
    <SiteLayout>
      {data.status === "ready" ? (
        <DeveloperDashboard keys={data.keys} />
      ) : (
        <main className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="text-3xl font-semibold">Unable to load API keys</h1>
          <p role="alert" className="mt-6">
            {data.message}
          </p>
        </main>
      )}
    </SiteLayout>
  );
}

function DeveloperDashboard({
  keys,
}: {
  keys: Extract<
    Awaited<ReturnType<typeof getDeveloperDashboard>>,
    { status: "ready" }
  >["keys"];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setReady(true), []);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as {
        error?: { message?: string };
        key?: string;
      };
      if (response.status === 401) {
        window.location.replace("/auth/login");
        return;
      }
      if (!response.ok) {
        setMessage(result.error?.message ?? "Unable to update API keys.");
        return;
      }
      if (result.key) setSecret(result.key);
      await router.invalidate();
    } catch {
      setMessage("Unable to update API keys.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-100 space-y-6">
      <h1 className="text-3xl font-semibold">Developer API keys</h1>
      <p>
        Create up to five active keys. Keep them on your server; every key can
        create rooms and shares your account’s ten requests per minute.
      </p>
      <a className="underline" href="/docs">
        API documentation
      </a>
      {secret && (
        <section className="rounded border border-indigo-500 p-4 space-y-3">
          <h2 className="font-semibold">Copy your new API key</h2>
          <p>This secret is shown only once.</p>
          <code className="block break-all select-all">{secret}</code>
          <button className="underline" onClick={() => setSecret("")}>
            I saved this key
          </button>
        </section>
      )}
      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSecret("");
          void mutate("/api/auth/developer/keys", "POST", { name });
        }}
      >
        <input
          aria-label="Key name"
          disabled={!ready || busy}
          placeholder="Key name"
          required
          maxLength={64}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 p-3 flex-1"
        />
        <button
          className="rounded bg-indigo-600 px-4 disabled:opacity-50"
          disabled={
            !ready ||
            busy ||
            keys.filter((key) => key.status === "active").length >= 5
          }
        >
          Create key
        </button>
      </form>
      <p role="status">{message}</p>
      <ul className="space-y-3">
        {keys.map((key) => (
          <li
            className="rounded border border-zinc-700 p-4 flex justify-between gap-4"
            key={key.id}
          >
            <div>
              <strong>{key.name}</strong>
              <p className="text-zinc-400">
                {key.prefix}… · {key.status}
              </p>
              <time dateTime={key.createdAt}>{key.createdAt.slice(0, 10)}</time>
            </div>
            {key.status === "active" && (
              <button
                disabled={!ready || busy}
                className="underline"
                onClick={() => {
                  setSecret("");
                  void mutate(
                    `/api/auth/developer/keys/${encodeURIComponent(key.id)}`,
                    "DELETE",
                  );
                }}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        className="underline"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error("Sign out failed");
            window.location.replace("/auth/login");
          } catch {
            setMessage("Unable to sign out. Please try again.");
            setBusy(false);
          }
        }}
      >
        Sign out
      </button>
    </main>
  );
}
