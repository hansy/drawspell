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
  const game = hostName ? `${hostName}'s game` : 'a game';
  const players =
    typeof playerCount === 'number' && playerCount > 0
      ? ` · ${playerCount} ${playerCount === 1 ? 'player' : 'players'} at the table`
      : '';
  return `${spectator ? 'Watching' : 'Joining'} ${game}${players}`;
};

export function UsernamePromptScreen({ sessionId }: { sessionId?: string }) {
  const setUsername = useClientPrefsStore((state) => state.setUsername);
  const invite = useInviteContext(sessionId);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="max-w-xl w-full px-8 py-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
        {invite && (
          <p
            data-invite-context
            className="mb-3 text-sm font-medium text-indigo-300"
          >
            {describeInvite(invite)}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight mb-4">Choose a username</h1>
        <p className="text-zinc-300 mb-6">
          This name is saved on this device and used for future games.
        </p>

        <UsernameForm
          initialValue={createSuggestedUsername()}
          submitLabel="Continue"
          showRandomize
          onRandomize={createSuggestedUsername}
          onSubmit={(username) => setUsername(username)}
        />
      </div>
    </div>
  );
}
