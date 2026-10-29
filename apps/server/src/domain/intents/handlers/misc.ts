import { normalizeCounterType } from "@mtg/shared/counters";
import {
  MAX_BATTLEFIELD_VIEW_SCALE,
  MIN_BATTLEFIELD_VIEW_SCALE,
} from "@mtg/shared/constants/geometry";
import { clampNumber } from "../../positions";
import { randomInt } from "../../random";
import { MAX_DICE_SIDES, MAX_RANDOM_COUNT } from "@mtg/shared/constants/limits";
import { ensureActorMatches, readNumber, requireNonEmptyStringProp } from "../validation";
import type { IntentHandler } from "./types";

const handleBattlefieldScale: IntentHandler = ({ actorId, maps, payload }) => {
  const playerIdResult = requireNonEmptyStringProp(payload, "playerId", "invalid scale");
  if (!playerIdResult.ok) return playerIdResult;
  const scaleRaw = readNumber(payload.scale);
  if (scaleRaw === undefined) return { ok: false, error: "invalid scale" };
  const allowed = ensureActorMatches(actorId, playerIdResult.value);
  if (!allowed.ok) return allowed;
  maps.battlefieldViewScale.set(
    playerIdResult.value,
    clampNumber(
      scaleRaw,
      MIN_BATTLEFIELD_VIEW_SCALE,
      MAX_BATTLEFIELD_VIEW_SCALE,
    ),
  );
  return { ok: true };
};

const handleGlobalCounterAdd: IntentHandler = ({ maps, payload }) => {
  const counterTypeResult = requireNonEmptyStringProp(payload, "counterType", "invalid counter");
  if (!counterTypeResult.ok) return counterTypeResult;
  const colorResult = requireNonEmptyStringProp(payload, "color", "invalid counter");
  if (!colorResult.ok) return colorResult;
  const normalizedType = normalizeCounterType(counterTypeResult.value);
  if (!normalizedType) return { ok: false, error: "invalid counter" };
  const existing = Array.from(maps.globalCounters.keys()).some(
    (key) => normalizeCounterType(String(key)) === normalizedType
  );
  if (!existing) {
    maps.globalCounters.set(normalizedType, colorResult.value);
  }
  return { ok: true };
};

const readRandomCount = (value: unknown) => {
  const count = readNumber(value);
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  const safe = Math.floor(count);
  return safe >= 1 && safe <= MAX_RANDOM_COUNT ? safe : null;
};

// Results are generated here; any results a client sends are ignored so they can't be faked.
const handleCoinFlip: IntentHandler = ({ actorId, payload, pushLogEvent }) => {
  const count = readRandomCount(payload.count);
  if (!count) return { ok: false, error: "invalid coin flip" };
  const results = Array.from({ length: count }, () =>
    randomInt(2) === 1 ? ("heads" as const) : ("tails" as const)
  );
  pushLogEvent("coin.flip", {
    actorId,
    count,
    results,
  });
  return { ok: true };
};

const handleDiceRoll: IntentHandler = ({ actorId, payload, pushLogEvent }) => {
  const rawSides = readNumber(payload.sides);
  const sides =
    typeof rawSides === "number" && Number.isFinite(rawSides) ? Math.floor(rawSides) : 0;
  const count = readRandomCount(payload.count);
  if (sides < 2 || sides > MAX_DICE_SIDES || !count) {
    return { ok: false, error: "invalid dice roll" };
  }
  const results = Array.from({ length: count }, () => randomInt(sides));
  pushLogEvent("dice.roll", {
    actorId,
    sides,
    count,
    results,
  });
  return { ok: true };
};

export const miscIntentHandlers: Record<string, IntentHandler> = {
  "ui.battlefieldScale.set": handleBattlefieldScale,
  "counter.global.add": handleGlobalCounterAdd,
  "coin.flip": handleCoinFlip,
  "dice.roll": handleDiceRoll,
};
