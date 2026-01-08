import type { Card, GameState } from "@/types";

import { getZoneByType } from "@/lib/gameSelectors";
import { ZONE, isCommanderZoneType } from "@/constants/zones";
import { canViewZone } from "@/rules/permissions";
import { logPermission } from "@/rules/logger";
import { resetCardToFrontFace } from "@/lib/cardDisplay";
import { enforceZoneCounterRules } from "@/lib/counters";
import { emitLog } from "@/logging/logStore";
import { resetDeck as yResetDeck } from "@/yjs/yMutations";
import type { Deps, GetState, SetState } from "./types";
import { useCommandLog } from "@/lib/featureFlags";
import { enqueueLocalCommand, getActiveCommandLog, buildHiddenZonePayloads } from "@/commandLog";

export const createResetDeck =
  (
    set: SetState,
    get: GetState,
    { applyShared, buildLogContext }: Deps
  ): GameState["resetDeck"] =>
  (playerId, actorId, _isRemote) => {
    const actor = actorId ?? playerId;
    const role = actor === get().myPlayerId ? get().viewerRole : "player";
    const state = get();
    const libraryZone = getZoneByType(state.zones, playerId, ZONE.LIBRARY);
    const commanderZone = getZoneByType(state.zones, playerId, ZONE.COMMANDER);
    if (!libraryZone) return;

    const viewPermission = canViewZone({ actorId: actor, role }, libraryZone, {
      viewAll: true,
    });
    if (!viewPermission.allowed) {
      logPermission({
        action: "resetDeck",
        actorId: actor,
        allowed: false,
        reason: viewPermission.reason,
        details: { playerId },
      });
      return;
    }

    if (useCommandLog) {
      const active = getActiveCommandLog();
      if (active) {
        const current = get();
        const nextCards = { ...current.cards };
        const nextZones = { ...current.zones };

        const commanderZone = getZoneByType(current.zones, playerId, ZONE.COMMANDER);
        const commanderOwned =
          commanderZone?.cardIds.filter((id) => nextCards[id]?.ownerId === playerId) ?? [];
        const commanderKeeps =
          commanderZone?.cardIds.filter((id) => nextCards[id]?.ownerId !== playerId) ?? [];
        const toCommander: string[] = [];

        const libraryKeeps =
          nextZones[libraryZone.id]?.cardIds.filter((id) => {
            const card = nextCards[id];
            return card && card.ownerId !== playerId;
          }) ?? [];
        libraryKeeps.forEach((id) => {
          const card = nextCards[id];
          if (!card) return;
          nextCards[id] = {
            ...card,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
          };
        });

        const toLibrary: string[] = [];

        const ownedCards = Object.values(current.cards).filter(
          (card) => card.ownerId === playerId
        );
        ownedCards.forEach((card) => {
          const fromZone = nextZones[card.zoneId];
          const inCommanderZone =
            fromZone && fromZone.ownerId === playerId && isCommanderZoneType(fromZone.type);
          if (inCommanderZone) return;
          const inSideboard =
            fromZone && fromZone.ownerId === playerId && fromZone.type === ZONE.SIDEBOARD;
          if (inSideboard && !card.isCommander) return;
          if (fromZone) {
            nextZones[card.zoneId] = {
              ...fromZone,
              cardIds: fromZone.cardIds.filter((id) => id !== card.id),
            };
          }

          if (card.isToken === true) {
            Reflect.deleteProperty(nextCards, card.id);
            return;
          }

          if (card.isCommander && commanderZone) {
            const resetCard = resetCardToFrontFace(card);
            nextCards[card.id] = {
              ...resetCard,
              zoneId: commanderZone.id,
              tapped: false,
              faceDown: false,
              controllerId: card.ownerId,
              knownToAll: true,
              revealedToAll: false,
              revealedTo: [],
              position: { x: 0, y: 0 },
              rotation: 0,
              customText: undefined,
              counters: enforceZoneCounterRules(resetCard.counters, commanderZone),
              isCommander: true,
            };
            toCommander.push(card.id);
            return;
          }

          const resetCard = resetCardToFrontFace(card);
          nextCards[card.id] = {
            ...resetCard,
            zoneId: libraryZone.id,
            tapped: false,
            faceDown: false,
            controllerId: card.ownerId,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
            position: { x: 0, y: 0 },
            rotation: 0,
            customText: undefined,
            counters: enforceZoneCounterRules(resetCard.counters, libraryZone),
          };
          toLibrary.push(card.id);
        });

        const shuffled = [...libraryKeeps, ...toLibrary].sort(() => Math.random() - 0.5);
        nextZones[libraryZone.id] = { ...nextZones[libraryZone.id], cardIds: shuffled };
        if (commanderZone) {
          nextZones[commanderZone.id] = {
            ...nextZones[commanderZone.id],
            cardIds: [...commanderKeeps, ...commanderOwned, ...toCommander],
          };
        }

        const publicOwnedBefore = Object.values(current.cards).filter((card) => {
          const zone = current.zones[card.zoneId];
          if (!zone) return false;
          const isHidden = zone.type === ZONE.HAND || zone.type === ZONE.LIBRARY || zone.type === ZONE.SIDEBOARD;
          return card.ownerId === playerId && !isHidden;
        });

        publicOwnedBefore.forEach((ownedCard) => {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "card.remove.public",
            buildPayloads: () => ({ payloadPublic: { cardId: ownedCard.id } }),
          });
        });

        const publicOwnedAfter = Object.values(nextCards).filter((card) => {
          const zone = nextZones[card.zoneId];
          if (!zone) return false;
          const isHidden = zone.type === ZONE.HAND || zone.type === ZONE.LIBRARY || zone.type === ZONE.SIDEBOARD;
          return card.ownerId === playerId && !isHidden;
        });

        publicOwnedAfter.forEach((ownedCard) => {
          enqueueLocalCommand({
            sessionId: active.sessionId,
            commands: active.commands,
            type: "card.create.public",
            buildPayloads: () => ({ payloadPublic: { card: ownedCard } }),
          });
        });

        const libraryCards = shuffled
          .map((id) => nextCards[id])
          .filter((c): c is Card => Boolean(c));

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "zone.set.hidden",
          buildPayloads: async () => {
            const payloads = await buildHiddenZonePayloads({
              sessionId: active.sessionId,
              ownerId: playerId,
              zoneType: ZONE.LIBRARY,
              cards: libraryCards,
              order: shuffled,
            });
            return {
              payloadPublic: payloads.payloadPublic,
              payloadOwnerEnc: payloads.payloadOwnerEnc,
              payloadSpectatorEnc: payloads.payloadSpectatorEnc,
            };
          },
        });

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "zone.set.hidden",
          buildPayloads: async () => {
            const payloads = await buildHiddenZonePayloads({
              sessionId: active.sessionId,
              ownerId: playerId,
              zoneType: ZONE.HAND,
              cards: [],
              order: [],
            });
            return {
              payloadPublic: payloads.payloadPublic,
              payloadOwnerEnc: payloads.payloadOwnerEnc,
              payloadSpectatorEnc: payloads.payloadSpectatorEnc,
            };
          },
        });

        enqueueLocalCommand({
          sessionId: active.sessionId,
          commands: active.commands,
          type: "library.topReveal.set",
          buildPayloads: () => ({
            payloadPublic: { ownerId: playerId, mode: null },
          }),
        });

        logPermission({
          action: "resetDeck",
          actorId: actor,
          allowed: true,
          details: { playerId },
        });
        emitLog("deck.reset", { actorId: actor, playerId }, buildLogContext());
        return;
      }
    }

    const sharedApplied = applyShared((maps) => {
      yResetDeck(maps, playerId);
    });

    if (!sharedApplied) {
      set((current) => {
        const nextCards = { ...current.cards };
        const nextZones = { ...current.zones };

        const ownedCards = Object.values(current.cards).filter(
          (card) => card.ownerId === playerId
        );
        const commanderOwned =
          commanderZone?.cardIds.filter((id) => nextCards[id]?.ownerId === playerId) ?? [];
        const commanderKeeps =
          commanderZone?.cardIds.filter((id) => nextCards[id]?.ownerId !== playerId) ?? [];
        const toCommander: string[] = [];
        const libraryKeeps =
          nextZones[libraryZone.id]?.cardIds.filter((id) => {
            const card = nextCards[id];
            return card && card.ownerId !== playerId;
          }) ?? [];
        libraryKeeps.forEach((id) => {
          const card = nextCards[id];
          if (!card) return;
          nextCards[id] = {
            ...card,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
          };
        });

        const toLibrary: string[] = [];

        ownedCards.forEach((card) => {
          const fromZone = nextZones[card.zoneId];
          const inCommanderZone =
            fromZone && fromZone.ownerId === playerId && isCommanderZoneType(fromZone.type);
          if (inCommanderZone) return;
          const inSideboard =
            fromZone && fromZone.ownerId === playerId && fromZone.type === ZONE.SIDEBOARD;
          if (inSideboard && !card.isCommander) return;
          if (fromZone) {
            nextZones[card.zoneId] = {
              ...fromZone,
              cardIds: fromZone.cardIds.filter((id) => id !== card.id),
            };
          }

          if (card.isToken === true) {
            Reflect.deleteProperty(nextCards, card.id);
            return;
          }

          if (card.isCommander && commanderZone) {
            const resetCard = resetCardToFrontFace(card);
            nextCards[card.id] = {
              ...resetCard,
              zoneId: commanderZone.id,
              tapped: false,
              faceDown: false,
              controllerId: card.ownerId,
              knownToAll: true,
              revealedToAll: false,
              revealedTo: [],
              position: { x: 0, y: 0 },
              rotation: 0,
              customText: undefined,
              counters: enforceZoneCounterRules(resetCard.counters, commanderZone),
              isCommander: true,
            };
            toCommander.push(card.id);
            return;
          }

          const resetCard = resetCardToFrontFace(card);
          nextCards[card.id] = {
            ...resetCard,
            zoneId: libraryZone.id,
            tapped: false,
            faceDown: false,
            controllerId: card.ownerId,
            knownToAll: false,
            revealedToAll: false,
            revealedTo: [],
            position: { x: 0, y: 0 },
            rotation: 0,
            customText: undefined,
            counters: enforceZoneCounterRules(resetCard.counters, libraryZone),
          };
          toLibrary.push(card.id);
        });

        const shuffled = [...libraryKeeps, ...toLibrary].sort(() => Math.random() - 0.5);
        nextZones[libraryZone.id] = { ...nextZones[libraryZone.id], cardIds: shuffled };
        if (commanderZone) {
          nextZones[commanderZone.id] = {
            ...nextZones[commanderZone.id],
            cardIds: [...commanderKeeps, ...commanderOwned, ...toCommander],
          };
        }

        const nextPlayers = current.players[playerId]
          ? {
              ...current.players,
              [playerId]: {
                ...current.players[playerId],
                libraryTopReveal: undefined,
              },
            }
          : current.players;

        return { cards: nextCards, zones: nextZones, players: nextPlayers };
      });
    }

    logPermission({
      action: "resetDeck",
      actorId: actor,
      allowed: true,
      details: { playerId },
    });
    emitLog("deck.reset", { actorId: actor, playerId }, buildLogContext());
  };
