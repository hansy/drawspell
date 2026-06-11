import type { GameState } from "@/types";

import { ZONE } from "@/constants/zones";
import { canMoveCard } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import {
  resolveBattlefieldCollisionPosition,
  resolveBattlefieldGroupCollisionPositions,
} from "@/lib/battlefieldCollision";
import { resetCardToFrontFace } from "@/lib/cardDisplay";
import { getCanonicalBattlefieldGridSteps } from "@/lib/positions";
import { syncCommanderDecklistForPlayer } from "@/store/gameStore/actions/deck/commanderDecklist";
import { debugLog, type DebugFlagKey } from "@/lib/debug";
import { normalizeMovePosition, planCardMovement } from "../movementModel";
import { moveCardIdBetweenZones, removeCardFromZones } from "../movementState";
import type { Deps, GetState, SetState } from "./types";

export const createMoveCard =
  (_set: SetState, get: GetState, { dispatchIntent }: Deps): GameState["moveCard"] =>
  (cardId, toZoneId, position, actorId, _isRemote, opts) => {
    const actor = actorId ?? get().myPlayerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const snapshot = get();
    const card = snapshot.cards[cardId];
    if (!card) return;

    const fromZoneId = card.zoneId;
    const fromZone = snapshot.zones[fromZoneId];
    const toZone = snapshot.zones[toZoneId];

    if (!fromZone || !toZone) return;

    const permission = canMoveCard({
      actorId: actor,
      role,
      card,
      fromZone,
      toZone,
    });
    if (!permission.allowed) {
      logPermission({
        action: "moveCard",
        actorId: actor,
        allowed: false,
        reason: permission.reason,
        details: { cardId, fromZoneId, toZoneId },
      });
      return;
    }
    logPermission({
      action: "moveCard",
      actorId: actor,
      allowed: true,
      details: { cardId, fromZoneId, toZoneId },
    });

    const initialPlan = planCardMovement({
      card,
      fromZone,
      toZone,
      placement: "top",
      position,
      opts,
    });
    const shouldSyncCommander =
      initialPlan.shouldMarkCommander && actor === get().myPlayerId && card.ownerId === actor;
    const debugKey: DebugFlagKey = "faceDownDrag";
    const resolvedOpts = opts;

    const applyMove = (state: GameState) => {
      const cardsCopy = { ...state.cards };
      const workingCard = cardsCopy[cardId];
      if (!workingCard) return state;
      const toZoneState = state.zones[toZoneId] ?? toZone;
      const currentFromZoneId = workingCard.zoneId;
      const currentFromZone = state.zones[currentFromZoneId] ?? fromZone;
      if (!toZoneState || !currentFromZone) return state;

      const tokenLeavingBattlefield =
        workingCard.isToken && toZoneState.type !== ZONE.BATTLEFIELD;
      if (tokenLeavingBattlefield) {
        Reflect.deleteProperty(cardsCopy, cardId);
        return {
          cards: cardsCopy,
          zones: removeCardFromZones(state.zones, cardId, [
            currentFromZoneId,
            toZoneId,
          ]),
        };
      }

      const fallbackPosition =
        !position &&
        toZoneState.type === ZONE.BATTLEFIELD &&
        currentFromZone.type !== ZONE.BATTLEFIELD
          ? { x: 0.5, y: 0.5 }
          : position;
      const newPosition = normalizeMovePosition(
        fallbackPosition,
        workingCard.position
      );
      let resolvedPosition = newPosition;

      if (
        toZoneState.type === ZONE.BATTLEFIELD &&
        fallbackPosition &&
        (!resolvedOpts?.skipCollision || resolvedOpts?.groupCollision)
      ) {
        if (resolvedOpts?.groupCollision) {
          const resolvedPositions =
            resolveBattlefieldGroupCollisionPositions({
              movingCardIds: resolvedOpts.groupCollision.movingCardIds,
              targetPositions: resolvedOpts.groupCollision.targetPositions,
              orderedCardIds:
                state.zones[toZoneId]?.cardIds ?? toZoneState.cardIds,
              getPosition: (id) => cardsCopy[id]?.position,
              getStepY: (id) =>
                getCanonicalBattlefieldGridSteps({
                  isTapped: cardsCopy[id]?.tapped,
                }).stepY,
            });
          resolvedPosition = resolvedPositions[cardId] ?? newPosition;
        } else {
          const stepY = getCanonicalBattlefieldGridSteps({
            isTapped: workingCard.tapped,
          }).stepY;
          resolvedPosition = resolveBattlefieldCollisionPosition({
            movingCardId: cardId,
            targetPosition: newPosition,
            orderedCardIds:
              state.zones[toZoneId]?.cardIds ?? toZoneState.cardIds,
            getPosition: (id) => cardsCopy[id]?.position,
            stepY,
          });
        }
      }

      const plan = planCardMovement({
        card: workingCard,
        fromZone: currentFromZone,
        toZone: toZoneState,
        placement: "top",
        position: resolvedPosition,
        opts: resolvedOpts,
      });

      const nextCard = plan.resetToFrontFace
        ? resetCardToFrontFace(workingCard)
        : workingCard;

      if (workingCard.faceDown || plan.faceDown.effectiveFaceDown) {
        debugLog(debugKey, "apply-move", {
          cardId,
          fromZoneId: currentFromZoneId,
          toZoneId,
          position: resolvedPosition,
          faceDown: plan.faceDown.effectiveFaceDown,
          overlayActive: Boolean(state.privateOverlay),
        });
      }

      if (currentFromZoneId === toZoneId) {
        cardsCopy[cardId] = {
          ...nextCard,
          ...plan.cardPatch,
        };
        return {
          cards: cardsCopy,
          zones: moveCardIdBetweenZones({
            zones: state.zones,
            cardId,
            fromZoneId: currentFromZoneId,
            toZoneId,
            placement: "top",
          }),
        };
      }

      cardsCopy[cardId] = {
        ...nextCard,
        ...plan.cardPatch,
      };

      return {
        cards: cardsCopy,
        zones: moveCardIdBetweenZones({
          zones: state.zones,
          cardId,
          fromZoneId: currentFromZoneId,
          toZoneId,
          placement: "top",
        }),
      };
    };

    dispatchIntent({
      type: "card.move",
      payload: {
        cardId,
        toZoneId,
        position,
        actorId: actor,
        opts: resolvedOpts ?? null,
      },
      applyLocal: applyMove,
      isRemote: _isRemote,
    });

    if (shouldSyncCommander) {
      syncCommanderDecklistForPlayer({
        state: get(),
        playerId: actor,
        override: { cardId: card.id, isCommander: true, name: card.name, ownerId: card.ownerId },
      });
    }
  };
