import type { Card, Player, Zone } from "@mtg/shared/types";
import { createJSONStorage } from "zustand/middleware";

import { createGameStoreStorage } from "../src/lib/safeStorage";
import { mergePrivateOverlay } from "../src/store/gameStore/overlay";
import { sanitizeSharedSnapshot } from "../src/yjs/sanitizeSharedSnapshot";

const PLAYERS = 4;
const CARDS_PER_PLAYER = 200;
const TOTAL_CARDS = PLAYERS * CARDS_PER_PLAYER;
const WARMUP_ROUNDS = 8;
const SAMPLE_ROUNDS = 30;
const ITERATIONS_PER_SAMPLE = 5;

type BenchmarkResult = {
  name: string;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  iterations: number;
};

const round = (value: number) => Number(value.toFixed(4));

const percentile = (sorted: number[], fraction: number) => {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)] ?? 0;
};

const benchmark = (name: string, operation: () => void): BenchmarkResult => {
  for (let roundIndex = 0; roundIndex < WARMUP_ROUNDS; roundIndex += 1) {
    for (let iteration = 0; iteration < ITERATIONS_PER_SAMPLE; iteration += 1) {
      operation();
    }
  }

  const samples: number[] = [];
  for (let roundIndex = 0; roundIndex < SAMPLE_ROUNDS; roundIndex += 1) {
    const startedAt = performance.now();
    for (let iteration = 0; iteration < ITERATIONS_PER_SAMPLE; iteration += 1) {
      operation();
    }
    samples.push((performance.now() - startedAt) / ITERATIONS_PER_SAMPLE);
  }

  samples.sort((left, right) => left - right);
  return {
    name,
    medianMs: round(percentile(samples, 0.5)),
    p95Ms: round(percentile(samples, 0.95)),
    minMs: round(samples[0] ?? 0),
    maxMs: round(samples.at(-1) ?? 0),
    iterations: SAMPLE_ROUNDS * ITERATIONS_PER_SAMPLE,
  };
};

const createSlowCountingStorage = () => {
  const values = new Map<string, string>();
  let writes = 0;
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      const blockedUntil = performance.now() + 0.05;
      while (performance.now() < blockedUntil) {
        // Model the synchronous main-thread cost of a small localStorage write.
      }
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
  return { storage, getWrites: () => writes };
};

const benchmarkPersistedUpdates = () => {
  const backing = createSlowCountingStorage();
  const storage = createJSONStorage(() => createGameStoreStorage(backing.storage));
  if (!storage) throw new Error("Expected JSON storage");
  const persisted = {
    state: {
      playerIdsBySession: { benchmark: "p1" },
      sessionVersions: { benchmark: 1 },
    },
    version: 2,
  };
  const startedAt = performance.now();
  for (let index = 0; index < 1_000; index += 1) {
    storage.setItem("drawspell-storage", persisted);
  }
  return {
    durationMs: round(performance.now() - startedAt),
    writes: backing.getWrites(),
    updates: 1_000,
  };
};

const createPlayer = (id: string): Player => ({
  id,
  name: `Player ${id}`,
  life: 20,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

const createZone = (id: string, ownerId: string, type: Zone["type"]): Zone => ({
  id,
  ownerId,
  type,
  cardIds: [],
});

const createCard = (id: string, ownerId: string, zoneId: string, index: number): Card => ({
  id,
  ownerId,
  controllerId: ownerId,
  zoneId,
  name: `Card ${id}`,
  tapped: index % 3 === 0,
  faceDown: false,
  position: {
    x: (index % 20) / 20,
    y: Math.floor(index / 20) / 10,
  },
  rotation: 0,
  counters: [],
  oracleText: "Benchmark card text",
  imageUrl: `https://img.example/${id}.jpg`,
});

const createSnapshot = () => {
  const players: Record<string, Player> = {};
  const zones: Record<string, Zone> = {};
  const cards: Record<string, Card> = {};
  const handRevealsToAll: Record<string, { name: string }> = {};
  const libraryRevealsToAll: Record<
    string,
    { ownerId: string; orderKey: string; card: { name: string } }
  > = {};
  const faceDownRevealsToAll: Record<string, { name: string }> = {};
  const playerOrder: string[] = [];

  for (let playerIndex = 0; playerIndex < PLAYERS; playerIndex += 1) {
    const playerId = `p${playerIndex + 1}`;
    const zoneId = `battlefield-${playerId}`;
    players[playerId] = createPlayer(playerId);
    playerOrder.push(playerId);
    const zone = createZone(zoneId, playerId, "battlefield");
    zones[zoneId] = zone;

    for (let cardIndex = 0; cardIndex < CARDS_PER_PLAYER; cardIndex += 1) {
      const id = `card-${playerId}-${cardIndex}`;
      cards[id] = createCard(id, playerId, zoneId, cardIndex);
      zone.cardIds.push(id);
      handRevealsToAll[id] = { name: `Hand ${id}` };
      libraryRevealsToAll[id] = {
        ownerId: playerId,
        orderKey: String(cardIndex).padStart(4, "0"),
        card: { name: `Library ${id}` },
      };
      faceDownRevealsToAll[id] = { name: `Face down ${id}` };
    }
  }

  return {
    players,
    zones,
    cards,
    handRevealsToAll,
    libraryRevealsToAll,
    faceDownRevealsToAll,
    globalCounters: { poison: "#22c55e" },
    battlefieldViewScale: Object.fromEntries(playerOrder.map((id) => [id, 1])),
    playerOrder,
    meta: { hostId: playerOrder[0] },
  };
};

const snapshot = createSnapshot();
const sanitized = sanitizeSharedSnapshot(snapshot);
const baseState = {
  ...sanitized,
  privateOverlay: null,
} as any;
const overlay = {
  cards: Object.values(snapshot.cards).slice(0, TOTAL_CARDS / 2),
  zoneCardOrders: Object.fromEntries(
    Object.values(snapshot.zones).map((zone) => [zone.id, zone.cardIds]),
  ),
};

const memoryBefore = process.memoryUsage();
const persistedUpdates = benchmarkPersistedUpdates();
const results = [
  benchmark("sanitizeSharedSnapshot:max-room", () => {
    sanitizeSharedSnapshot(snapshot);
  }),
  benchmark("mergePrivateOverlay:half-room", () => {
    mergePrivateOverlay(baseState, overlay);
  }),
];
const memoryAfter = process.memoryUsage();

const report = {
  runtime: `bun ${Bun.version}`,
  fixture: {
    players: PLAYERS,
    cards: TOTAL_CARDS,
    revealEntriesPerCollection: TOTAL_CARDS,
    overlayCards: overlay.cards.length,
  },
  benchmark: {
    warmupRounds: WARMUP_ROUNDS,
    sampleRounds: SAMPLE_ROUNDS,
    iterationsPerSample: ITERATIONS_PER_SAMPLE,
  },
  results,
  persistedUpdates,
  memory: {
    heapUsedDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
    rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
  },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`client performance bench (${report.runtime})`);
  console.table(results);
  console.log(
    `heap delta: ${(report.memory.heapUsedDeltaBytes / 1024 / 1024).toFixed(2)} MB; ` +
      `RSS delta: ${(report.memory.rssDeltaBytes / 1024 / 1024).toFixed(2)} MB`,
  );
}
