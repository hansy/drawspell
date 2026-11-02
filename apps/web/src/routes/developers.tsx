import { getLocale } from "@/paraglide/runtime.js";
import { readLocalePath } from "@/i18n/urls";
import { formatDate } from "@/i18n/format";
import { localeHref } from "@/i18n/navigation";
import { m } from "@/paraglide/messages.js";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    if (readLocalePath(location.pathname).pathname.replace(/\/$/, "") !== "/developers")
      throw notFound();
  },
  loader: () => getDeveloperDashboard({ data: { locale: getLocale() } }),
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
          <h1 className="text-3xl font-semibold">{m.developers_unable_to_load_api_keys()}</h1>
          <p role="alert" className="mt-6">
            {data.message}
          </p>
        </main>
      )}
    </SiteLayout>
  );
}

export function DeveloperDashboard({
  keys,
}: {
  keys: Extract<
    Awaited<ReturnType<typeof getDeveloperDashboard>>,
    { status: "ready" }
  >["keys"];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [keyDialog, setKeyDialog] = useState<
    | { kind: "closed" }
    | { kind: "name" }
    | { kind: "secret"; value: string }
  >({ kind: "closed" });
  const secret = keyDialog.kind === "secret" ? keyDialog.value : "";
  const keyInput = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const createButton = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<
    | { kind: "idle" }
    | { kind: "create" }
    | { kind: "delete"; id: string; phase: "request" | "exit" }
    | { kind: "sign-out" }
  >({ kind: "idle" });
  const busy = pending.kind !== "idle";
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (keyDialog.kind === "secret") keyInput.current?.focus({ preventScroll: true });
  }, [keyDialog.kind]);
  async function mutate(operation: { kind: "create"; name: string } | { kind: "delete"; id: string }) {
    if (busy) return;
    setPending(operation.kind === "delete"
      ? { kind: "delete", id: operation.id, phase: "request" }
      : { kind: "create" });
    const path = operation.kind === "create"
      ? "/api/auth/developer/keys"
      : `/api/auth/developer/keys/${encodeURIComponent(operation.id)}`;
    setMessage("");
    try {
      const response = await fetch(path, {
        method: operation.kind === "create" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: operation.kind === "create" ? JSON.stringify({ name: operation.name }) : undefined,
      });
      const result = (await response.json()) as {
        error?: { message?: string };
        key?: string;
      };
      if (response.status === 401) {
        window.location.replace(localeHref("/auth/login"));
        return;
      }
      if (!response.ok) {
        setMessage(m.developers_unable_to_update_api_keys());
        return;
      }
      if (result.key) {
        setCopyStatus("idle");
        setKeyDialog({ kind: "secret", value: result.key });
        setName("");
      }
      if (operation.kind === "delete") {
        setPending({ kind: "delete", id: operation.id, phase: "exit" });
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          await new Promise((resolve) => window.setTimeout(resolve, 200));
        }
      }
      await router.invalidate();
    } catch {
      setMessage(m.developers_unable_to_update_api_keys());
    } finally {
      setPending({ kind: "idle" });
    }
  }
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 text-zinc-100 sm:py-16">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{m.developers_developer_api_keys()}</h1>
      <button
        ref={createButton}
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-medium transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!ready || busy || keys.filter((key) => key.status === "active").length >= 5}
        onClick={() => {
          setName("");
          setMessage("");
          setCopyStatus("idle");
          setKeyDialog({ kind: "name" });
        }}
      >
        {m.developers_create_key()}</button>
      <Dialog open={keyDialog.kind !== "closed"} onOpenChange={(open) => {
        if (!open && pending.kind !== "create") setKeyDialog({ kind: "closed" });
      }}>
        <DialogContent
          className="border-zinc-800 bg-zinc-950 text-zinc-100"
          showCloseButton={pending.kind !== "create"}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            createButton.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              <span key={keyDialog.kind} className="block animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                {keyDialog.kind === "secret" ? m.developers_your_api_key() : m.developers_create_api_key()}
              </span>
            </DialogTitle>
            <DialogDescription className={keyDialog.kind === "secret" ? "text-zinc-400" : "sr-only"}>
              {keyDialog.kind === "secret" ? m.developers_copy_this_key_before_closing_it_is_only_shown_once() : m.developers_give_your_api_key_a_name()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0">
            <form
              aria-hidden={keyDialog.kind !== "name"}
              inert={keyDialog.kind !== "name"}
              className={`col-start-1 row-start-1 space-y-4 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none ${keyDialog.kind === "name" ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (!ready || busy || keyDialog.kind !== "name") return;
                void mutate({ kind: "create", name });
              }}
            >
              <div className="space-y-2">
                <label htmlFor="api-key-name" className="text-sm font-medium text-zinc-300">{m.developers_key_name()}</label>
                <Input
                  id="api-key-name"
                  disabled={busy}
                  placeholder={m.developers_e_g_my_app()}
                  required
                  maxLength={64}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <button
                type="submit"
                aria-busy={pending.kind === "create"}
                disabled={busy || !name.trim()}
                className="inline-grid min-h-11 w-full place-items-center rounded-lg bg-indigo-600 px-5 text-sm font-medium transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={`col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none ${pending.kind === "create" ? "opacity-0" : "opacity-100"}`}>{m.developers_create_key()}</span>
                <span aria-hidden="true" className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none ${pending.kind === "create" ? "opacity-100" : "opacity-0"}`}>
                  <LoaderCircle className={`size-4 ${pending.kind === "create" ? "motion-safe:animate-spin" : ""}`} />
                  {m.developers_creating()}</span>
              </button>
              {keyDialog.kind === "name" && message && <p role="alert" className="text-sm text-red-400">{message}</p>}
            </form>
            <div
              aria-hidden={keyDialog.kind !== "secret"}
              inert={keyDialog.kind !== "secret"}
              className={`col-start-1 row-start-1 min-w-0 space-y-3 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none ${keyDialog.kind === "secret" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
            >
              <div className="relative min-w-0">
                <Input
                  ref={keyInput}
                  aria-label={m.developers_api_key()}
                  value={secret}
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-12 border-zinc-700 bg-zinc-900 pr-12 font-mono text-sm text-zinc-100"
                />
                <button
                  type="button"
                  aria-label={copyStatus === "copied" ? m.developers_api_key_copied() : m.developers_copy_api_key()}
                  className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret);
                      setCopyStatus("copied");
                    } catch {
                      setCopyStatus("error");
                    }
                  }}
                >
                  {copyStatus === "copied" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </div>
              <p role="status" className="text-sm text-zinc-400 empty:hidden">
                {copyStatus === "copied" ? m.developers_copied_to_clipboard() : copyStatus === "error" ? m.developers_unable_to_copy_select_the_key_and_copy_it_manually() : ""}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {keyDialog.kind === "closed" && <p role="status" className="mt-3 text-sm text-red-400 empty:hidden">{message}</p>}
      <ul className="mt-8 border-t border-zinc-800 empty:border-0">
        {keys.map((key) => (
          <li
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${pending.kind === "delete" && pending.id === key.id && pending.phase === "exit" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
            aria-busy={pending.kind === "delete" && pending.id === key.id}
            key={key.id}
          >
            <div className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 py-5">
            <div className="min-w-0">
              <strong className="block truncate text-sm font-medium">{key.name}</strong>
              <p className="mt-1 text-xs text-zinc-500">
                {key.prefix}… · {key.status}
              </p>
              <time className="mt-1 block text-xs text-zinc-500" dateTime={key.createdAt}>{formatDate(key.createdAt)}</time>
            </div>
              <button
                disabled={!ready || busy}
                aria-label={pending.kind === "delete" && pending.id === key.id ? m.developers_deleting({ name: key.name }) : m.developers_delete({ name: key.name })}
                className="relative inline-grid min-w-24 shrink-0 place-items-center rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setKeyDialog({ kind: "closed" });
                  void mutate({ kind: "delete", id: key.id });
                }}
              >
                <span className={`col-start-1 row-start-1 transition-opacity duration-150 motion-reduce:transition-none ${pending.kind === "delete" && pending.id === key.id ? "opacity-0" : "opacity-100"}`}>{m.developers_delete_2()}</span>
                <span aria-hidden="true" className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none ${pending.kind === "delete" && pending.id === key.id ? "opacity-100" : "opacity-0"}`}>
                  <LoaderCircle className={`size-3.5 ${pending.kind === "delete" && pending.id === key.id ? "motion-safe:animate-spin" : ""}`} />
                  {m.developers_deleting_2()}</span>
              </button>
            </div>
            </div>
          </li>
        ))}
      </ul>
      <nav aria-label={m.developers_developer_links()} className="mt-8 flex items-center gap-6 text-sm text-zinc-400">
      <a className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-100" href={localeHref("/docs")} target="_blank" rel="noopener noreferrer">
        {m.developers_api_documentation()}<ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
      <button
        className="transition-colors hover:text-zinc-100 disabled:opacity-50"
        disabled={!ready || busy}
        onClick={async () => {
          setPending({ kind: "sign-out" });
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error(m.developers_sign_out_failed());
            window.location.replace(localeHref("/auth/login"));
          } catch {
            setMessage(m.developers_unable_to_sign_out_please_try_again());
            setPending({ kind: "idle" });
          }
        }}
      >
        {m.developers_sign_out()}</button>
      </nav>
    </main>
  );
}
