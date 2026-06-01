import { createFileRoute } from "@tanstack/react-router";
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

function GameRoute() {
  const { sessionId } = Route.useParams();
  const hasHydrated = useClientPrefsStore((state) => state.hasHydrated);
  const username = useClientPrefsStore((state) => state.username);

  if (!hasHydrated) return null;

  if (!username) {
    return (
      <Suspense fallback={null}>
        <UsernamePromptScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <MultiplayerBoard sessionId={sessionId} />
    </Suspense>
  );
}
