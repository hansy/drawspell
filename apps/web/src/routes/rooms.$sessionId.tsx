import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { resolveOriginsForEnv } from "@/lib/runtimeOrigins";
import { useClientPrefsStore } from "@/store/clientPrefsStore";

const origins = resolveOriginsForEnv(import.meta.env.VITE_ENV);
const MultiplayerBoard = lazy(() =>
  import("@/components/game/board/MultiplayerBoard").then((module) => ({
    default: module.MultiplayerBoard,
  }))
);
const UsernamePromptScreen = lazy(() =>
  import("@/components/username/UsernamePromptScreen").then((module) => ({
    default: module.UsernamePromptScreen,
  }))
);

export const Route = createFileRoute("/rooms/$sessionId")({
  component: GameRoute,
  head: () => ({
    meta: [
      { title: "Game | Drawspell" },
      { name: "description", content: "Game in session" },
      {
        name: "og:image",
        content: `${origins.web}/og-image.png`,
      },
    ],
  }),
});

export function GameRoute() {
  const { sessionId } = Route.useParams();
  const hasHydrated = useClientPrefsStore((state) => state.hasHydrated);
  const username = useClientPrefsStore((state) => state.username);

  if (!hasHydrated) return <RoomRouteLoadingScreen />;

  if (!username) {
    return (
      <Suspense fallback={<RoomRouteLoadingScreen />}>
        <UsernamePromptScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RoomRouteLoadingScreen />}>
      <MultiplayerBoard sessionId={sessionId} />
    </Suspense>
  );
}

function RoomRouteLoadingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300"
      >
        <Loader2
          aria-hidden="true"
          size={16}
          className="text-zinc-400 motion-safe:animate-spin"
        />
        <span>Loading game</span>
      </div>
    </div>
  );
}
