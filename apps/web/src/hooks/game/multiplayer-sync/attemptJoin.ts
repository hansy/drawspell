import { useClientPrefsStore } from "@/store/clientPrefsStore";
import { useCommandLog } from "@/lib/featureFlags";
import type { CommandEnvelope } from "@/commandLog/types";
import { enqueueLocalCommand } from "@/commandLog/localWriter";
import type * as Y from "yjs";
import { ensureLocalPlayerInitialized } from "./ensureLocalPlayerInitialized";
import type { SharedMaps } from "@/yjs/yMutations";
import { useGameStore } from "@/store/gameStore";
import { getDefaultPlayerName, resolveDesiredPlayerName } from "./ensureLocalPlayerInitialized";
import { computePlayerColors, resolveOrderedPlayerIds } from "@/lib/playerColors";
import { MAX_PLAYERS } from "@/lib/room";
import { getOrCreateSessionIdentity } from "@/lib/sessionIdentity";

export type JoinStateSetter = (
  blocked: boolean,
  reason: NonNullable<ReturnType<typeof ensureLocalPlayerInitialized>>["reason"] | null,
) => void;

export function createAttemptJoin({
  docTransact,
  sharedMaps,
  playerId,
  setJoinState,
  getRole,
  sessionId,
  commands,
}: {
  docTransact: (fn: (tran: unknown) => void) => void;
  sharedMaps: SharedMaps;
  playerId: string;
  setJoinState: JoinStateSetter;
  getRole: () => string;
  sessionId?: string;
  commands?: Y.Array<CommandEnvelope>;
}) {
  return () => {
    if (getRole() === "spectator") {
      setJoinState(false, null);
      return;
    }

    if (useCommandLog && sessionId && commands) {
      const state = useGameStore.getState();
      const playerExists = Boolean(state.players[playerId]);
      const playerCount = Object.keys(state.players).length;
      const roomIsFull = playerCount >= MAX_PLAYERS;
      const roomOverCapacity = playerCount > MAX_PLAYERS;
      const roomLockedByHost = state.roomLockedByHost;
      const roomIsLocked = roomLockedByHost || roomIsFull;

      if (!playerExists && roomIsLocked) {
        const reason = roomOverCapacity ? "overCapacity" : roomIsFull ? "full" : "locked";
        setJoinState(true, reason);
        return;
      }

      if (!playerExists) {
        const defaultName = getDefaultPlayerName(playerId);
        const desiredName = resolveDesiredPlayerName(
          useClientPrefsStore.getState().username,
          defaultName,
        );
        const orderedIds = resolveOrderedPlayerIds(state.players, state.playerOrder);
        const ordered = orderedIds.includes(playerId) ? orderedIds : [...orderedIds, playerId];
        const colors = computePlayerColors(ordered);
        const color = state.players[playerId]?.color ?? colors[playerId];
        const identity = getOrCreateSessionIdentity(sessionId);

        enqueueLocalCommand({
          sessionId,
          commands,
          type: "player.join",
          buildPayloads: () => ({
            payloadPublic: {
              playerId,
              name: desiredName,
              color,
              signPubKey: identity.signPublicKey,
              encPubKey: identity.encPublicKey,
            },
          }),
        });
      }

      setJoinState(false, null);
      return;
    }

    const commandLog =
      useCommandLog && sessionId && commands
        ? { sessionId, commands }
        : undefined;
    const result = ensureLocalPlayerInitialized({
      transact: (fn) => docTransact(fn),
      sharedMaps,
      playerId,
      preferredUsername: useClientPrefsStore.getState().username,
      commandLog,
    });
    const blocked = result?.status === "blocked";
    setJoinState(blocked, blocked ? result!.reason : null);
  };
}
