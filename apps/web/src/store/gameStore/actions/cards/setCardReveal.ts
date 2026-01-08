import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { patchCard as yPatchCard } from "@/yjs/yMutations";
import { buildRevealPatch } from "../cardsModel";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";
import { base64UrlToBytes } from "@/crypto/base64url";
import { encryptPayloadForRecipient } from "@/commandLog/crypto";
import { generateX25519KeyPair } from "@/crypto/x25519";

export const createSetCardReveal =
  (
    set: SetState,
    get: GetState,
    { applyShared }: Deps
  ): GameState["setCardReveal"] =>
  (cardId, reveal, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const snapshot = get();
    if (snapshot.viewerRole === "spectator") return;
    const card = snapshot.cards[cardId];
    if (!card) return;
    if (actor !== card.ownerId) return;

    const zoneType = snapshot.zones[card.zoneId]?.type;
    if (zoneType !== ZONE.HAND && zoneType !== ZONE.LIBRARY) return;

    const updates = buildRevealPatch(card, reveal);

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const identity = {
          name: card.name,
          imageUrl: card.imageUrl,
          typeLine: card.typeLine,
          oracleText: card.oracleText,
          scryfallId: card.scryfallId,
          scryfall: card.scryfall,
          isToken: card.isToken,
        };
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.reveal.set",
          buildPayloads: async () => {
            const revealTo = reveal?.toAll ? [] : (reveal?.to ?? []);
            const payloadRecipientsEnc: Record<string, any> = {};
            if (revealTo && revealTo.length > 0) {
              for (const recipientId of revealTo) {
                const recipient = get().players[recipientId];
                if (!recipient?.encPubKey) continue;
                const recipientPubKey = base64UrlToBytes(recipient.encPubKey);
                const ephemeral = generateX25519KeyPair();
                payloadRecipientsEnc[recipientId] = await encryptPayloadForRecipient({
                  payload: identity,
                  recipientPubKey,
                  ephemeralKeyPair: ephemeral,
                  sessionId: active.sessionId,
                });
              }
            }

            return {
              payloadPublic: {
                cardId,
                zoneId: card.zoneId,
                revealToAll: Boolean(reveal?.toAll),
                revealTo: revealTo?.length ? revealTo : undefined,
                identity: reveal?.toAll ? identity : undefined,
              },
              payloadRecipientsEnc:
                Object.keys(payloadRecipientsEnc).length > 0
                  ? payloadRecipientsEnc
                  : undefined,
            };
          },
        });
        return;
      }
    }

    if (
      applyShared((maps) => {
        yPatchCard(maps, cardId, updates);
      })
    )
      return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...state.cards[cardId],
          ...updates,
        },
      },
    }));
  };
