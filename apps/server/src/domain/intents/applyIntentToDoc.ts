import type * as Y from "yjs";

import type {
  ApplyResult,
  HiddenReveal,
  HiddenState,
  InnerApplyResult,
  Intent,
  IntentImpact,
  LogEvent,
} from "../types";
import { getMaps } from "../yjsStore";
import { getIntentHandler } from "./handlers";
import { readActorId, readPayload } from "./validation";

const PUBLIC_DOC_NOOP_INTENTS = new Set([
  "library.view",
  "library.view.close",
  "library.view.ping",
  "coin.flip",
  "dice.roll",
]);

type HiddenChangeImpact = {
  ownerId?: string;
  zoneId?: string;
  reveal?: HiddenReveal;
  prevReveal?: HiddenReveal;
};

const createHiddenImpactTracker = () => {
  let hiddenChanged = false;
  const changedOwners = new Set<string>();
  const changedZones = new Set<string>();
  const changedRevealPlayers = new Set<string>();
  let changedRevealAll = false;

  const addRevealScope = (reveal?: HiddenReveal) => {
    if (!reveal) return;
    if (reveal.toAll) {
      changedRevealAll = true;
    }
    if (!Array.isArray(reveal.toPlayers)) return;
    reveal.toPlayers.forEach((playerId) => {
      if (typeof playerId === "string") {
        changedRevealPlayers.add(playerId);
      }
    });
  };

  return {
    markHiddenChanged: (impact?: HiddenChangeImpact) => {
      hiddenChanged = true;
      const hasScope = Boolean(
        impact?.ownerId || impact?.zoneId || impact?.reveal || impact?.prevReveal
      );
      if (!hasScope) {
        changedRevealAll = true;
      }
      if (impact?.ownerId) {
        changedOwners.add(impact.ownerId);
      }
      if (impact?.zoneId) {
        changedZones.add(impact.zoneId);
      }
      addRevealScope(impact?.reveal);
      addRevealScope(impact?.prevReveal);
    },
    hasHiddenChanges: () => hiddenChanged,
    buildImpact: (changedPublicDoc: boolean): IntentImpact => ({
      changedOwners: Array.from(changedOwners),
      changedZones: Array.from(changedZones),
      changedRevealScopes: {
        toAll: changedRevealAll,
        toPlayers: Array.from(changedRevealPlayers),
      },
      changedPublicDoc,
    }),
  };
};

export const applyIntentToDoc = (doc: Y.Doc, intent: Intent, hidden: HiddenState): ApplyResult => {
  if (!intent || typeof intent.type !== "string") {
    return { ok: false, error: "invalid intent" };
  }
  const payload = readPayload(intent.payload);
  const actorId = readActorId(payload);
  const maps = getMaps(doc);
  const logEvents: LogEvent[] = [];
  const hiddenImpact = createHiddenImpactTracker();
  let changedPublicDoc = false;
  const pushLogEvent = (eventId: string, logPayload: Record<string, unknown>) => {
    logEvents.push({ eventId, payload: logPayload });
  };

  const apply = (): InnerApplyResult => {
    if (!actorId) return { ok: false, error: "missing actor" };
    const handler = getIntentHandler(intent.type);
    if (!handler) return { ok: false, error: `unhandled intent: ${intent.type}` };
    return handler({
      intent,
      payload,
      actorId,
      maps,
      hidden,
      pushLogEvent,
      markHiddenChanged: hiddenImpact.markHiddenChanged,
    });
  };

  try {
    let result: InnerApplyResult = { ok: false, error: "unknown" };
    doc.transact(() => {
      result = apply();
    });
    if (result.ok) {
      if (!changedPublicDoc) {
        changedPublicDoc = !PUBLIC_DOC_NOOP_INTENTS.has(intent.type);
      }
      const impact = hiddenImpact.buildImpact(changedPublicDoc);
      return {
        ok: true,
        logEvents,
        ...(hiddenImpact.hasHiddenChanges() ? { hiddenChanged: true } : null),
        impact,
      };
    }
    return result;
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "intent failed" };
  }
};
