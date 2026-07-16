import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createRoomId } from "@/lib/roomId";
import {
  clearRoomHostPending,
  isRoomHostPending,
  isRoomUnavailable,
  markRoomAsHostPending,
  readRoomTokensFromStorage,
  writeRoomTokensToStorage,
} from "@/lib/partyKitToken";
import { useClientPrefsStore } from "@/store/clientPrefsStore";
import { FooterLinks } from "@/components/landing/FooterLinks";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { LandingHero } from "@/components/landing/LandingHero";
import { OrbitAnimation } from "@/components/landing/OrbitAnimation";
import { ResumeCard } from "@/components/landing/ResumeCard";
import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";
import { getRoomStatus } from "@/server/roomStatus";

const origins = resolveOriginsForEnv(import.meta.env.VITE_ENV);
type GameRuntimeWindow = Window & { __drawspellGameRuntimeLoaded?: boolean };

const cleanupGameRuntime = async () => {
  const [{ clearIntentTransport }, { destroyAllSessions }] = await Promise.all([
    import("@/partykit/intentTransport"),
    import("@/yjs/docManager"),
  ]);
  destroyAllSessions();
  clearIntentTransport();
  if (typeof window !== "undefined") {
    (window as GameRuntimeWindow).__drawspellGameRuntimeLoaded = false;
  }
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const hasHydrated = useClientPrefsStore((state) => state.hasHydrated);
  const lastSessionId = useClientPrefsStore((state) => state.lastSessionId);
  const clearLastSessionId = useClientPrefsStore(
    (state) => state.clearLastSessionId,
  );
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Debug toggle: show the CTA even when the reconnect card is visible.
  const showCtaWithReconnect = false;

  useEffect(() => {
    if (!(window as GameRuntimeWindow).__drawspellGameRuntimeLoaded) return;

    let cancelled = false;
    const cleanup = () => {
      if (!cancelled) void cleanupGameRuntime();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(cleanup, { timeout: 1_000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(cleanup, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!lastSessionId) {
      setResumeSessionId(null);
      return;
    }
    const storedTokens = readRoomTokensFromStorage(lastSessionId);
    const canResume = Boolean(
      storedTokens?.playerToken ||
      storedTokens?.spectatorToken ||
      isRoomHostPending(lastSessionId),
    );
    if (!canResume || isRoomUnavailable(lastSessionId)) {
      setResumeSessionId(null);
      clearLastSessionId();
      return;
    }

    const accessToken =
      storedTokens?.playerToken ?? storedTokens?.spectatorToken ?? null;
    if (!accessToken) {
      setResumeSessionId(lastSessionId);
      return;
    }

    let cancelled = false;
    setResumeSessionId(null);
    void getRoomStatus({ data: { roomId: lastSessionId, accessToken } })
      .then(async ({ exists }) => {
        if (cancelled) return;
        if (exists) {
          setResumeSessionId(lastSessionId);
          return;
        }
        clearRoomHostPending(lastSessionId);
        writeRoomTokensToStorage(lastSessionId, null);
        clearLastSessionId();
        const { useGameStore } = await import("@/store/gameStore");
        useGameStore.getState().forgetSessionIdentity(lastSessionId);
      })
      .catch(() => {
        // A transient status outage should not discard a valid saved room.
        if (!cancelled) setResumeSessionId(lastSessionId);
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, lastSessionId, clearLastSessionId]);

  const handleCreateGame = () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const sessionId = createRoomId();
      markRoomAsHostPending(sessionId);
      navigate({ to: "/rooms/$sessionId", params: { sessionId } });
    } catch (error) {
      setIsCreating(false);
      throw error;
    }
  };

  const handleReconnect = () => {
    if (!resumeSessionId) return;
    navigate({
      to: "/rooms/$sessionId",
      params: { sessionId: resumeSessionId },
    });
  };

  const handleLeave = () => {
    if (!resumeSessionId) return;
    clearRoomHostPending(resumeSessionId);
    writeRoomTokensToStorage(resumeSessionId, null);
    clearLastSessionId();
    setResumeSessionId(null);

    void import("@/store/gameStore").then(({ useGameStore }) => {
      const store = useGameStore.getState();
      store.setRoomTokens(null);
      store.forgetSessionIdentity(resumeSessionId);
      store.resetSession();
    });
    void cleanupGameRuntime();
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b0a0f] text-zinc-100">
      <LandingBackground />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
          <a
            href="/"
            className="text-md font-semibold uppercase tracking-[0.3em] text-zinc-200/80 transition hover:text-zinc-50"
          >
            Drawspell
          </a>
        </header>
        <LandingHero
          badge="No downloads - No login"
          title="Just Magic"
          description="Drawspell is a web-based virtual tabletop simulator for playing Magic: The Gathering. Create a room, share with friends, and play together."
          animation={
            <OrbitAnimation className="h-[340px] w-[340px] sm:h-[320px] sm:w-[320px] lg:h-[680px] lg:w-[680px]" />
          }
          secondaryPanel={
            resumeSessionId ? (
              <ResumeCard onReconnect={handleReconnect} onLeave={handleLeave} />
            ) : null
          }
          primaryAction={
            resumeSessionId && !showCtaWithReconnect ? null : (
              <button
                onClick={handleCreateGame}
                disabled={isCreating}
                aria-busy={isCreating}
                className="w-full max-w-[calc(100vw-3rem)] rounded-full border border-white/20 bg-white/25 px-6 py-3 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.25)] transition hover:bg-white/35 disabled:cursor-not-allowed disabled:opacity-70 sm:max-w-sm"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {isCreating && (
                    <Loader2
                      aria-hidden="true"
                      className="h-4 w-4 motion-safe:animate-spin"
                    />
                  )}
                  {isCreating ? "Starting game" : "Start a game"}
                </span>
              </button>
            )
          }
        />
        <FooterLinks />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Magic: The Gathering Virtual Tabletop | Drawspell" },
      {
        name: "description",
        content:
          "Drawspell is a web-based virtual tabletop simulator for playing Magic: The Gathering. No login, no downloads required.",
      },
      {
        name: "og:image",
        content: `${origins.web}/og-image.png`,
      },
      {
        name: "og:url",
        content: origins.web,
      },
    ],
  }),
});
