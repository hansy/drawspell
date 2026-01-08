import type { GameState } from "@/types";

import { v4 as uuidv4 } from "uuid";

import { canModifyCardState } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import { duplicateCard as yDuplicateCard } from "@/yjs/yMutations";
import { ZONE } from "@/constants/zones";
import {
  buildDuplicateTokenCard,
  computeDuplicateTokenPosition,
} from "../cardsModel";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";
import { extractCardIdentity, stripCardIdentity } from "@/commandLog/identity";
import {
  deriveSpectatorAesKey,
  encryptJsonPayload,
  encryptPayloadForRecipient,
} from "@/commandLog/crypto";
import { generateX25519KeyPair } from "@/crypto/x25519";
import { getSessionAccessKeys } from "@/lib/sessionKeys";
import { base64UrlToBytes } from "@/crypto/base64url";

export const createDuplicateCard =
  (
    _set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["duplicateCard"] =>
  (cardId, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const state = get();
    const sourceCard = state.cards[cardId];
    if (!sourceCard) return;

    const currentZone = state.zones[sourceCard.zoneId];
    if (!currentZone) return;

    const tokenPermission = canModifyCardState(
      { actorId: actor, role },
      sourceCard,
      currentZone
    );
    if (!tokenPermission.allowed) {
      logPermission({
        action: "duplicateCard",
        actorId: actor,
        allowed: false,
        reason: tokenPermission.reason,
        details: { cardId, zoneId: currentZone.id },
      });
      return;
    }

    const newCardId = uuidv4();
    const position = computeDuplicateTokenPosition({
      sourceCard,
      orderedCardIds: currentZone.cardIds,
      cardsById: state.cards,
    });
    const clonedCard = buildDuplicateTokenCard({
      sourceCard,
      newCardId,
      position,
    });

    logPermission({
      action: "duplicateCard",
      actorId: actor,
      allowed: true,
      details: { cardId, newCardId, zoneId: currentZone.id },
    });
    emitLog(
      "card.duplicate",
      {
        actorId: actor,
        sourceCardId: cardId,
        newCardId,
        zoneId: currentZone.id,
        cardName: sourceCard.name,
      },
      buildLogContext()
    );
    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.create.public",
          buildPayloads: async () => {
            const shouldHideIdentity =
              currentZone.type === ZONE.BATTLEFIELD && clonedCard.faceDown;
            let payloadRecipientsEnc: Record<string, any> | undefined;
            let payloadSpectatorEnc: string | undefined;
            if (shouldHideIdentity) {
              const identity = extractCardIdentity(clonedCard);
              const owner = get().players[clonedCard.ownerId];
              if (owner?.encPubKey) {
                const recipientPubKey = base64UrlToBytes(owner.encPubKey);
                const ephemeral = generateX25519KeyPair();
                payloadRecipientsEnc = {
                  [clonedCard.ownerId]: await encryptPayloadForRecipient({
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
                payloadSpectatorEnc = await encryptJsonPayload(
                  spectatorKey,
                  identity,
                );
              }
            }
            return {
              payloadPublic: {
                card: shouldHideIdentity
                  ? stripCardIdentity(clonedCard)
                  : clonedCard,
              },
              payloadRecipientsEnc,
              payloadSpectatorEnc,
            };
          },
        });
        return;
      }
    }

    if (applyShared((maps) => yDuplicateCard(maps, cardId, newCardId))) return;
    get().addCard(clonedCard, _isRemote);
  };
