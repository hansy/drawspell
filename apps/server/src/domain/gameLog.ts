import type { LogEvent } from "./types";

export type GameLogEntry = LogEvent & {
  seq: number;
  ts: number;
};

export type GameLogSnapshot = {
  nextSeq: number;
  entries: GameLogEntry[];
};

export type GameLogReplayResult =
  | { kind: "replay"; entries: GameLogEntry[] }
  | { kind: "snapshot"; entries: GameLogEntry[] };

const normalizeSeq = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  if (value < 0) return null;
  return value;
};

const normalizeEntry = (value: unknown): GameLogEntry | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const seq = normalizeSeq(record.seq);
  if (seq === null) return null;
  if (typeof record.ts !== "number" || !Number.isFinite(record.ts)) {
    return null;
  }
  if (typeof record.eventId !== "string" || record.eventId.length === 0) {
    return null;
  }
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};
  return {
    seq,
    ts: record.ts,
    eventId: record.eventId,
    payload,
  };
};

export class GameLogBuffer {
  private entries: GameLogEntry[] = [];
  private nextSeq = 1;

  constructor(private readonly maxEntries: number) {}

  append(events: LogEvent[], timestamp: number = Date.now()): GameLogEntry[] {
    if (events.length === 0) return [];
    const appended = events.map((event) => ({
      seq: this.nextSeq++,
      ts: timestamp,
      eventId: event.eventId,
      payload: event.payload,
    }));
    this.entries.push(...appended);
    this.trim();
    return appended;
  }

  snapshot(): GameLogSnapshot {
    return {
      nextSeq: this.nextSeq,
      entries: this.entries.map((entry) => ({ ...entry })),
    };
  }

  restore(snapshot: unknown) {
    if (!snapshot || typeof snapshot !== "object") return;
    const record = snapshot as Record<string, unknown>;
    const entries = Array.isArray(record.entries)
      ? record.entries.map(normalizeEntry).filter((entry) => entry !== null)
      : [];
    entries.sort((a, b) => a.seq - b.seq);
    this.entries = entries.slice(-this.maxEntries);
    const storedNextSeq = normalizeSeq(record.nextSeq);
    const lastSeq = this.entries[this.entries.length - 1]?.seq ?? 0;
    this.nextSeq =
      storedNextSeq !== null ? Math.max(storedNextSeq, lastSeq + 1) : lastSeq + 1;
  }

  clear() {
    this.entries = [];
    this.nextSeq = 1;
  }

  replayAfter(lastSeq: unknown): GameLogReplayResult {
    const normalized = normalizeSeq(lastSeq);
    if (normalized === null) {
      return { kind: "snapshot", entries: this.snapshot().entries };
    }
    const lastStoredSeq = this.entries[this.entries.length - 1]?.seq ?? this.nextSeq - 1;
    if (normalized > lastStoredSeq) {
      return { kind: "snapshot", entries: this.snapshot().entries };
    }
    const firstSeq = this.entries[0]?.seq;
    if (firstSeq !== undefined && normalized < firstSeq - 1) {
      return { kind: "snapshot", entries: this.snapshot().entries };
    }
    return {
      kind: "replay",
      entries: this.entries
        .filter((entry) => entry.seq > normalized)
        .map((entry) => ({ ...entry })),
    };
  }

  private trim() {
    if (this.entries.length <= this.maxEntries) return;
    this.entries.splice(0, this.entries.length - this.maxEntries);
  }
}
