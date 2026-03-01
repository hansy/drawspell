import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type LegalLayoutProps = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

export function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <main className="min-h-dvh bg-[#0b0a0f] px-6 py-8 text-zinc-100 sm:px-10 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            to="/"
            className="w-fit text-sm font-semibold uppercase tracking-[0.26em] text-zinc-300 transition hover:text-zinc-50"
          >
            Drawspell
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {title}
            </h1>
            <p className="text-sm text-zinc-400">Last updated: {updatedAt}</p>
          </div>
        </header>
        <article className="space-y-6 text-sm leading-6 text-zinc-200 sm:text-base">
          {children}
        </article>
      </div>
    </main>
  );
}
