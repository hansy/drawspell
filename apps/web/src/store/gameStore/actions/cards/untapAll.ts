import type { GameState } from "@/types";

import { emitLog } from "@/logging/logStore";
import { patchCard as yPatchCard, sharedSnapshot } from "@/yjs/yMutations";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";

export const createUntapAll =
  (
    set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["untapAll"] =>
  (playerId, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.untapAll",
          buildPayloads: () => ({
            payloadPublic: { playerId },
          }),
        });
        emitLog("card.untapAll", { actorId: playerId, playerId }, buildLogContext());
        return;
      }
    }

    if (
      applyShared((maps) => {
        const snapshot = sharedSnapshot(maps);
        Object.values(snapshot.cards).forEach((card) => {
          if (card.controllerId === playerId && card.tapped) {
            yPatchCard(maps, card.id, { tapped: false });
          }
        });
      })
    )
      return;

    set((state) => {
      const newCards = { ...state.cards };
      Object.values(newCards).forEach((card) => {
        if (card.controllerId === playerId && card.tapped) {
          newCards[card.id] = { ...card, tapped: false };
        }
      });
      return { cards: newCards };
    });
    emitLog("card.untapAll", { actorId: playerId, playerId }, buildLogContext());
  };
