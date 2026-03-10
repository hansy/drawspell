import { createFileRoute } from "@tanstack/react-router";
import { ORIGINS } from "@mtg/shared/constants/hosts";
import { MultiplayerBoard } from "@/components/game/board/MultiplayerBoard";
import { UsernamePromptScreen } from "@/components/username/UsernamePromptScreen";
import { useClientPrefsStore } from "@/store/clientPrefsStore";

const viteEnv = import.meta.env.VITE_ENV;
const origins = ORIGINS[viteEnv as keyof typeof ORIGINS];

if (!origins) {
  throw new Error(`Unsupported VITE_ENV: ${viteEnv}`);
}

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

  if (!username) return <UsernamePromptScreen />;

  return <MultiplayerBoard sessionId={sessionId} />;
}
