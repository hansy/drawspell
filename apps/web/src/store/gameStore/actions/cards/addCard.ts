import type { Card, GameState } from "@/types";

import { enforceZoneCounterRules } from "@/lib/counters";
import { upsertCard as yUpsertCard } from "@/yjs/yMutations";
import { normalizeCardForAdd } from "../cardsModel";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildHiddenZonePayloads, buildLibraryTopRevealPayload } from "@/commandLog";
import { extractCardIdentity, stripCardIdentity } from "@/commandLog/identity";
import { encryptPayloadForRecipient, deriveSpectatorAesKey, encryptJsonPayload } from "@/commandLog/crypto";
import { generateX25519KeyPair } from "@/crypto/x25519";
import { getSessionAccessKeys } from "@/lib/sessionKeys";
import { base64UrlToBytes } from "@/crypto/base64url";
import { ZONE } from "@/constants/zones";

export const createAddCard =
  (set: SetState, get: GetState, { applyShared }: Deps): GameState["addCard"] =>
  (card, _isRemote) => {
    if (get().viewerRole === "spectator") return;
    const normalizedCard = normalizeCardForAdd(card);

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const zone = get().zones[normalizedCard.zoneId];
        if (zone && (zone.type === ZONE.LIBRARY || zone.type === ZONE.HAND || zone.type === ZONE.SIDEBOARD)) {
          const order = [...zone.cardIds, normalizedCard.id];
          const cards = order
            .map((id) => (id === normalizedCard.id ? normalizedCard : get().cards[id]))
            .filter((c): c is Card => Boolean(c));
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "zone.set.hidden",
            buildPayloads: async () => {
              const payloads = await buildHiddenZonePayloads({
                sessionId: active.sessionId,
                ownerId: zone.ownerId,
                zoneType: zone.type,
                cards,
                order,
              });
              return {
                payloadPublic: payloads.payloadPublic,
                payloadOwnerEnc: payloads.payloadOwnerEnc,
                payloadSpectatorEnc: payloads.payloadSpectatorEnc,
              };
            },
          });
          if (
            zone.type === ZONE.LIBRARY &&
            get().players[zone.ownerId]?.libraryTopReveal === "all"
          ) {
            const cardsById = Object.fromEntries(cards.map((c) => [c.id, c]));
            enqueueLocalCommand({
              sessionId: active.sessionId,
              commands: active.commands,
              type: "library.topReveal.set",
              buildPayloads: () =>
                buildLibraryTopRevealPayload({
                  ownerId: zone.ownerId,
                  order,
                  cardsById,
                }),
            });
          }
          return;
        }

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.create.public",
          buildPayloads: async () => {
            const shouldHideIdentity =
              zone?.type === ZONE.BATTLEFIELD && normalizedCard.faceDown;
            let payloadRecipientsEnc: Record<string, any> | undefined;
            let payloadSpectatorEnc: string | undefined;
            if (shouldHideIdentity) {
              const identity = extractCardIdentity(normalizedCard);
              const owner = get().players[normalizedCard.ownerId];
              if (owner?.encPubKey) {
                const recipientPubKey = base64UrlToBytes(owner.encPubKey);
                const ephemeral = generateX25519KeyPair();
                payloadRecipientsEnc = {
                  [normalizedCard.ownerId]: await encryptPayloadForRecipient({
                    payload: identity,
                    recipientPubKey,
                    ephemeralKeyPair: ephemeral,
                    sessionId: active.sessionId,
                  }),
                };
              }
              const keys = getSessionAccessKeys(active.sessionId);
              if (keys.spectatorKey) {
                const spectatorKey = deriveSpectatorAesKey({
                  spectatorKey: base64UrlToBytes(keys.spectatorKey),
                  sessionId: active.sessionId,
                });
                payloadSpectatorEnc = await encryptJsonPayload(spectatorKey, identity);
              }
            }
            return {
              payloadPublic: {
                card: shouldHideIdentity ? stripCardIdentity(normalizedCard) : normalizedCard,
              },
              payloadRecipientsEnc,
              payloadSpectatorEnc,
            };
          },
        });
        return;
      }
    }

    if (
      applyShared((maps) => {
        yUpsertCard(maps, normalizedCard);
      })
    )
      return;

    set((state) => {
      const targetZone = state.zones[normalizedCard.zoneId];
      const cardWithCounters = {
        ...normalizedCard,
        counters: enforceZoneCounterRules(normalizedCard.counters, targetZone),
      };

      return {
        cards: { ...state.cards, [cardWithCounters.id]: cardWithCounters },
        zones: {
          ...state.zones,
          [cardWithCounters.zoneId]: {
            ...state.zones[cardWithCounters.zoneId],
            cardIds: [
              ...state.zones[cardWithCounters.zoneId].cardIds,
              cardWithCounters.id,
            ],
          },
        },
      };
    });
  };
