import { LanguageSelector } from "@/components/LanguageSelector";
import { m } from "@/paraglide/messages.js";
import { useEffect, useState } from 'react';

import { resolveInviteTokenFromUrl } from '@/lib/partyKitToken';
import { getRoomStatus } from '@/server/roomStatus';
import { createSuggestedUsername, useClientPrefsStore } from '@/store/clientPrefsStore';
import { UsernameForm } from './UsernameForm';

type InviteContext = { hostName: string | null; playerCount?: number; spectator: boolean };

// Someone arriving from an invite link sees whose game they're joining before choosing a name.
const useInviteContext = (sessionId?: string): InviteContext | null => {
  const [context, setContext] = useState<InviteContext | null>(null);

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const invite = resolveInviteTokenFromUrl(window.location.href);
    if (!invite.token) return;
    let cancelled = false;
    void getRoomStatus({ data: { roomId: sessionId, accessToken: invite.token } })
      .then((status) => {
        if (cancelled || !status.exists) return;
        setContext({
          hostName: status.hostName ?? null,
          playerCount: status.playerCount,
          spectator: invite.role === 'spectator',
        });
      })
      .catch(() => {
        // The prompt works without context; joining reports any real problem.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return context;
};

const describeInvite = ({ hostName, playerCount, spectator }: InviteContext) => {
  const game = hostName ? m.invite_host_game({ name: hostName }) : m.invite_a_game();
  const players = typeof playerCount === "number" && playerCount > 0 ? m.invite_players_at_table({ count: playerCount }) : "";
  return spectator ? m.invite_watching({ game, players }) : m.invite_joining({ game, players });
};

export function UsernamePromptScreen({ sessionId }: { sessionId?: string }) {
  const setUsername = useClientPrefsStore((state) => state.setUsername);
  const invite = useInviteContext(sessionId);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="absolute right-4 top-4"><LanguageSelector /></div>
      <div className="max-w-xl w-full px-8 py-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
        {invite && (
          <p
            data-invite-context
            className="mb-3 text-sm font-medium text-indigo-300"
          >
            {describeInvite(invite)}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight mb-4">{m.username_prompt_screen_choose_a_username()}</h1>
        <p className="text-zinc-300 mb-6">
          {m.username_prompt_screen_this_name_is_saved_on_this_device_and_used_for_future_games()}</p>

        <UsernameForm
          initialValue={createSuggestedUsername()}
          submitLabel={m.username_prompt_screen_continue()}
          showRandomize
          onRandomize={createSuggestedUsername}
          onSubmit={(username) => setUsername(username)}
        />
      </div>
    </div>
  );
}
