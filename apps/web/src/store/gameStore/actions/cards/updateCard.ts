import type { Card, GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { canModifyCardState } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { emitLog } from "@/logging/logStore";
import { enforceZoneCounterRules } from "@/lib/counters";
import { patchCard as yPatchCard } from "@/yjs/yMutations";
import { syncCommanderDecklistForPlayer } from "@/store/gameStore/actions/deck/commanderDecklist";
import { buildUpdateCardPatch } from "../cardsModel";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog } from "@/commandLog";
import { extractCardIdentity } from "@/commandLog/identity";
import { encryptPayloadForRecipient, deriveSpectatorAesKey, encryptJsonPayload } from "@/commandLog/crypto";
import { generateX25519KeyPair } from "@/crypto/x25519";
import { getSessionAccessKeys } from "@/lib/sessionKeys";
import { base64UrlToBytes } from "@/crypto/base64url";

export const createUpdateCard =
  (
    set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["updateCard"] =>
  (id, updates, actorId, _isRemote) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    if (role === "spectator") return;
    const cardBefore = get().cards[id];
    const isCommanderUpdate = Object.prototype.hasOwnProperty.call(updates, "isCommander");
    const isCommanderTaxUpdate = Object.prototype.hasOwnProperty.call(updates, "commanderTax");
    const shouldSyncCommander =
      isCommanderUpdate && cardBefore?.ownerId === actor && actor === get().myPlayerId;

    if (
      Object.prototype.hasOwnProperty.call(updates, "zoneId") ||
      Object.prototype.hasOwnProperty.call(updates, "position") ||
      Object.prototype.hasOwnProperty.call(updates, "counters")
    ) {
      console.warn(
        "[updateCard] Unsupported fields (use moveCard / addCounterToCard instead)",
        {
          cardId: id,
          fields: Object.keys(updates),
        }
      );
      return;
    }

    if (cardBefore) {
      const newPower = updates.power ?? cardBefore.power;
      const newToughness = updates.toughness ?? cardBefore.toughness;
      const powerChanged = newPower !== cardBefore.power;
      const toughnessChanged = newToughness !== cardBefore.toughness;
      if (
        (powerChanged || toughnessChanged) &&
        (newPower !== undefined || newToughness !== undefined)
      ) {
        emitLog(
          "card.pt",
          {
            actorId: actor,
            cardId: id,
            zoneId: cardBefore.zoneId,
            fromPower: cardBefore.power,
            fromToughness: cardBefore.toughness,
            toPower: newPower ?? cardBefore.power,
            toToughness: newToughness ?? cardBefore.toughness,
            cardName: cardBefore.name,
          },
          buildLogContext()
        );
      }
    }

    if (cardBefore) {
      if (isCommanderUpdate && cardBefore.ownerId !== actor) {
        logPermission({
          action: "updateCard",
          actorId: actor,
          allowed: false,
          reason: "Only owner may update commander status",
          details: { cardId: id, zoneId: cardBefore.zoneId, updates: ["isCommander"] },
        });
        return;
      }
      if (isCommanderTaxUpdate && cardBefore.ownerId !== actor) {
        logPermission({
          action: "updateCard",
          actorId: actor,
          allowed: false,
          reason: "Only owner may update commander tax",
          details: { cardId: id, zoneId: cardBefore.zoneId, updates: ["commanderTax"] },
        });
        return;
      }

      const cardZone = get().zones[cardBefore.zoneId];
      const controlledFields: Array<keyof Card> = [
        "power",
        "toughness",
        "basePower",
        "baseToughness",
        "customText",
        "faceDown",
        "currentFaceIndex",
      ];
      const requiresControl = Object.keys(updates).some((key) =>
        controlledFields.includes(key as keyof Card)
      );
      if (requiresControl) {
        const permission = canModifyCardState(
          { actorId: actor, role },
          cardBefore,
          cardZone
        );
        if (!permission.allowed) {
          logPermission({
            action: "updateCard",
            actorId: actor,
            allowed: false,
            reason: permission.reason,
            details: {
              cardId: id,
              zoneId: cardBefore.zoneId,
              updates: Object.keys(updates),
            },
          });
          return;
        }
      }
    }

    const zoneTypeBefore = cardBefore
      ? get().zones[cardBefore.zoneId]?.type
      : undefined;
    const shouldMarkKnownAfterFaceUp =
      cardBefore &&
      updates.faceDown === false &&
      cardBefore.faceDown === true &&
      zoneTypeBefore === ZONE.BATTLEFIELD;
    const shouldHideAfterFaceDown =
      cardBefore &&
      updates.faceDown === true &&
      cardBefore.faceDown === false &&
      zoneTypeBefore === ZONE.BATTLEFIELD;

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const patch = cardBefore ? buildUpdateCardPatch(cardBefore, updates).patch : updates;
        if (shouldMarkKnownAfterFaceUp) {
          patch.knownToAll = true;
        }
        if (shouldHideAfterFaceDown) {
          patch.knownToAll = false;
          patch.revealedToAll = false;
          patch.revealedTo = [];
        }
        if (shouldMarkKnownAfterFaceUp && cardBefore) {
          Object.assign(patch, extractCardIdentity(cardBefore));
        }

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "card.update.public",
          buildPayloads: async () => {
            let payloadRecipientsEnc: Record<string, any> | undefined;
            let payloadSpectatorEnc: string | undefined;
            if (shouldHideAfterFaceDown && cardBefore) {
              const identity = extractCardIdentity(cardBefore);
              const owner = get().players[cardBefore.ownerId];
              if (owner?.encPubKey) {
                const recipientPubKey = base64UrlToBytes(owner.encPubKey);
                const ephemeral = generateX25519KeyPair();
                payloadRecipientsEnc = {
                  [cardBefore.ownerId]: await encryptPayloadForRecipient({
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
              payloadPublic: { cardId: id, updates: patch },
              payloadRecipientsEnc,
              payloadSpectatorEnc,
            };
          },
        });
        if (shouldSyncCommander && cardBefore) {
          syncCommanderDecklistForPlayer({
            state: get(),
            playerId: actor,
            override: {
              cardId: id,
              isCommander: updates.isCommander === true,
              name: cardBefore.name,
              ownerId: cardBefore.ownerId,
            },
          });
        }
        return;
      }
    }

    const sharedApplied = applyShared((maps) => {
      if (!cardBefore) return;
      const { patch } = buildUpdateCardPatch(cardBefore, updates);
      if (shouldMarkKnownAfterFaceUp) patch.knownToAll = true;
      if (shouldHideAfterFaceDown) {
        patch.knownToAll = false;
        patch.revealedToAll = false;
        patch.revealedTo = [];
      }
      if (Object.keys(patch).length > 0) {
        yPatchCard(maps, id, patch);
      }
    });

    if (sharedApplied) {
      if (shouldSyncCommander && cardBefore) {
        syncCommanderDecklistForPlayer({
          state: get(),
          playerId: actor,
          override: {
            cardId: id,
            isCommander: updates.isCommander === true,
            name: cardBefore.name,
            ownerId: cardBefore.ownerId,
          },
        });
      }
      return;
    }

    set((state) => {
      const current = state.cards[id];
      if (!current) return state;

      const zone = state.zones[current.zoneId];
      const { next } = buildUpdateCardPatch(current, updates);
      const shouldMarkKnownAfterFaceUp =
        updates.faceDown === false &&
        current.faceDown === true &&
        zone?.type === ZONE.BATTLEFIELD;
      const shouldHideAfterFaceDown =
        updates.faceDown === true &&
        current.faceDown === false &&
        zone?.type === ZONE.BATTLEFIELD;
      const nextWithVisibility = shouldHideAfterFaceDown
        ? {
            ...next,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
          }
        : shouldMarkKnownAfterFaceUp
          ? { ...next, knownToAll: true }
          : next;

      return {
        cards: {
          ...state.cards,
          [id]: {
            ...nextWithVisibility,
            counters: enforceZoneCounterRules(nextWithVisibility.counters, zone),
          },
        },
      };
    });

    if (shouldSyncCommander && cardBefore) {
      syncCommanderDecklistForPlayer({
        state: get(),
        playerId: actor,
        override: {
          cardId: id,
          isCommander: updates.isCommander === true,
          name: cardBefore.name,
          ownerId: cardBefore.ownerId,
        },
      });
    }
  };
