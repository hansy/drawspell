import type {
  Card,
  FaceDownRevealsToAll,
  HandRevealsToAll,
  LibraryRevealsToAll,
  Player,
  Zone,
} from "@/types";

import { enforceZoneCounterRules } from "@/lib/counters";
import { MAX_CARDS, MAX_CARDS_PER_ZONE } from "@/lib/limits";
import {
  getCanonicalBattlefieldPlacementGridSteps,
  normalizedPositionKey,
  positionsRoughlyEqual,
  resolvePositionAgainstOccupied,
} from "@/lib/positions";
import { MAX_PLAYERS, MAX_ZONES } from "../sanitizeLimits";

import { sanitizeCard } from "./card";
import { sanitizeCardIdentity, sanitizeLibraryRevealEntry } from "./identity";
import { sanitizePlayer, sanitizePlayerOrder } from "./player";
import { clampNumber } from "./utils";
import { sanitizeZone } from "./zone";

export type SharedSnapshotLike = {
  players: Record<string, unknown>;
  zones: Record<string, unknown>;
  cards: Record<string, unknown>;
  handRevealsToAll?: Record<string, unknown>;
  libraryRevealsToAll?: Record<string, unknown>;
  faceDownRevealsToAll?: Record<string, unknown>;
  globalCounters: Record<string, unknown>;
  battlefieldViewScale?: Record<string, unknown>;
  playerOrder: unknown;
  meta?: Record<string, unknown>;
};

export function sanitizeSharedSnapshot(snapshot: SharedSnapshotLike) {
  const rawPlayerCount = Object.keys(snapshot.players).length;
  const roomOverCapacity = rawPlayerCount > MAX_PLAYERS;
  const safePlayers: Record<string, Player> = {};
  let playerCount = 0;
  Object.entries(snapshot.players).forEach(([key, value]) => {
    if (playerCount >= MAX_PLAYERS) return;
    const p = sanitizePlayer(value);
    if (p) {
      safePlayers[key] = p;
      playerCount++;
    }
  });

  const safeZones: Record<string, Zone> = {};
  let zoneCount = 0;
  Object.entries(snapshot.zones).forEach(([key, value]) => {
    if (zoneCount >= MAX_ZONES) return;
    const z = sanitizeZone(value);
    if (z) {
      safeZones[key] = z;
      zoneCount++;
    }
  });

  const safeCards: Record<string, Card> = {};
  let cardCount = 0;
  Object.entries(snapshot.cards).forEach(([key, value]) => {
    if (cardCount >= MAX_CARDS) return;
    const c = sanitizeCard(value, safeZones);
    if (c) {
      safeCards[key] = c;
      cardCount++;
    }
  });

  const safeHandRevealsToAll: HandRevealsToAll = {};
  const handRevealEntries = Object.entries(snapshot.handRevealsToAll ?? {});
  let handRevealCount = 0;
  handRevealEntries.forEach(([slotId, value]) => {
    if (handRevealCount >= MAX_CARDS) return;
    if (typeof slotId !== "string") return;
    const identity = sanitizeCardIdentity(value);
    if (identity) {
      safeHandRevealsToAll[slotId] = identity;
      handRevealCount += 1;
    }
  });

  const safeLibraryRevealsToAll: LibraryRevealsToAll = {};
  const libraryRevealEntries = Object.entries(snapshot.libraryRevealsToAll ?? {});
  let libraryRevealCount = 0;
  libraryRevealEntries.forEach(([revealId, value]) => {
    if (libraryRevealCount >= MAX_CARDS) return;
    if (typeof revealId !== "string") return;
    const entry = sanitizeLibraryRevealEntry(value);
    if (entry) {
      safeLibraryRevealsToAll[revealId] = entry;
      libraryRevealCount += 1;
    }
  });

  const safeFaceDownRevealsToAll: FaceDownRevealsToAll = {};
  const faceDownEntries = Object.entries(snapshot.faceDownRevealsToAll ?? {});
  let faceDownRevealCount = 0;
  faceDownEntries.forEach(([cardId, value]) => {
    if (faceDownRevealCount >= MAX_CARDS) return;
    if (typeof cardId !== "string") return;
    const identity = sanitizeCardIdentity(value);
    if (identity) {
      safeFaceDownRevealsToAll[cardId] = identity;
      faceDownRevealCount += 1;
    }
  });

  Object.values(safeZones).forEach((zone) => {
    const zoneType = zone.type;
    if (zoneType === "hand") {
      zone.cardIds = zone.cardIds.filter((id) => typeof id === "string");
      if (zone.cardIds.length > MAX_CARDS_PER_ZONE) {
        zone.cardIds = zone.cardIds.slice(0, MAX_CARDS_PER_ZONE);
      }
      return;
    }
    if (zoneType === "library" || zoneType === "sideboard") {
      zone.cardIds = [];
      return;
    }
    zone.cardIds = zone.cardIds.filter((id) => {
      const card = safeCards[id];
      return Boolean(card && card.zoneId === zone.id);
    });
  });

  const zoneCardIdSets = new Map<string, Set<string>>();
  Object.values(safeZones).forEach((zone) => {
    zoneCardIdSets.set(zone.id, new Set(zone.cardIds));
  });

  Object.values(safeCards).forEach((card) => {
    const zone = safeZones[card.zoneId];
    if (!zone) return;

    if (zone.type === "hand" || zone.type === "library" || zone.type === "sideboard") {
      return;
    }

    const zoneCardIds = zoneCardIdSets.get(zone.id);
    if (!zoneCardIds?.has(card.id)) {
      zone.cardIds.push(card.id);
      zoneCardIds?.add(card.id);
      if (zone.cardIds.length > MAX_CARDS_PER_ZONE) {
        zone.cardIds = zone.cardIds.slice(0, MAX_CARDS_PER_ZONE);
        zoneCardIdSets.set(zone.id, new Set(zone.cardIds));
      }
    }

    const counters = enforceZoneCounterRules(card.counters, zone);
    if (counters !== card.counters) {
      safeCards[card.id] = { ...card, counters };
    }
  });

  const battlefieldPlacementStepY = getCanonicalBattlefieldPlacementGridSteps().stepY;
  Object.values(safeZones).forEach((zone) => {
    if (zone.type !== "battlefield") return;

    const occupied = new Set<string>();
    zone.cardIds.forEach((cardId) => {
      const card = safeCards[cardId];
      if (!card) return;

      const resolved = resolvePositionAgainstOccupied({
        targetPosition: card.position,
        occupied,
        maxAttempts: MAX_CARDS_PER_ZONE,
        stepY: battlefieldPlacementStepY,
      });

      occupied.add(normalizedPositionKey(resolved));
      if (!positionsRoughlyEqual(card.position, resolved)) {
        safeCards[card.id] = { ...card, position: resolved };
      }
    });
  });

  const safeGlobalCounters: Record<string, string> = {};
  Object.entries(snapshot.globalCounters).forEach(([key, value]) => {
    if (typeof key === "string" && typeof value === "string") {
      safeGlobalCounters[key.slice(0, 64)] = value.slice(0, 16);
    }
  });

  const safeBattlefieldViewScale: Record<string, number> = {};
  Object.entries(snapshot.battlefieldViewScale ?? {}).forEach(([pid, value]) => {
    if (!safePlayers[pid]) return;
    safeBattlefieldViewScale[pid] = clampNumber(value, 0.5, 1, 1);
  });

  const safePlayerOrder = sanitizePlayerOrder(snapshot.playerOrder, safePlayers, MAX_PLAYERS);
  const rawMeta = snapshot.meta ?? {};
  const roomHostId =
    typeof rawMeta.hostId === "string" && rawMeta.hostId.length > 0
      ? rawMeta.hostId
      : null;

  return {
    players: safePlayers,
    zones: safeZones,
    cards: safeCards,
    handRevealsToAll: safeHandRevealsToAll,
    libraryRevealsToAll: safeLibraryRevealsToAll,
    faceDownRevealsToAll: safeFaceDownRevealsToAll,
    globalCounters: safeGlobalCounters,
    playerOrder: safePlayerOrder,
    battlefieldViewScale: safeBattlefieldViewScale,
    roomHostId,
    roomOverCapacity,
  };
}
