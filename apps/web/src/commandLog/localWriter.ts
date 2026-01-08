import type * as Y from "yjs";
import { v4 as uuidv4 } from "uuid";

import { base64UrlToBytes } from "@/crypto/base64url";
import {
  getOrCreateSessionIdentity,
  getSessionIdentityBytes,
} from "@/lib/sessionIdentity";
import { getSessionAccessKeys } from "@/lib/sessionKeys";

import { appendCommand, validateCommand } from "./commands";
import type { CommandEnvelope, CommandEnvelopeUnsigned } from "./types";

type AppendLocalCommandParams = {
  sessionId: string;
  commands: Y.Array<CommandEnvelope>;
  type: string;
  payloadPublic?: unknown;
  payloadOwnerEnc?: string;
  payloadSpectatorEnc?: string;
  payloadRecipientsEnc?: CommandEnvelopeUnsigned["payloadRecipientsEnc"];
};

type LocalCommandPayloads = {
  payloadPublic?: unknown;
  payloadOwnerEnc?: string;
  payloadSpectatorEnc?: string;
  payloadRecipientsEnc?: CommandEnvelopeUnsigned["payloadRecipientsEnc"];
};

type EnqueueLocalCommandParams = {
  sessionId: string;
  commands: Y.Array<CommandEnvelope>;
  type: string;
  buildPayloads: (ctx: {
    actorId: string;
    seq: number;
    ts: number;
  }) => LocalCommandPayloads | Promise<LocalCommandPayloads>;
};

const commandQueues = new Map<string, Promise<void>>();

export const getNextCommandSeq = (
  commands: Y.Array<CommandEnvelope>,
  actorId: string,
): number => {
  for (let i = commands.length - 1; i >= 0; i -= 1) {
    const entry = commands.get(i) as CommandEnvelope | undefined;
    if (!entry || entry.actorId !== actorId) continue;
    if (typeof entry.seq === "number" && Number.isFinite(entry.seq)) {
      return entry.seq + 1;
    }
  }
  return 1;
};

export const appendLocalCommand = (
  params: AppendLocalCommandParams,
): CommandEnvelope | null => {
  const keys = getSessionAccessKeys(params.sessionId);
  const playerKey = keys.playerKey;
  if (!playerKey) {
    console.warn("[command-log] missing playerKey; cannot append command");
    return null;
  }
  try {
    const identity = getOrCreateSessionIdentity(params.sessionId);
    const identityBytes = getSessionIdentityBytes(params.sessionId);
    const seq = getNextCommandSeq(params.commands, identity.playerId);

    const envelope: CommandEnvelopeUnsigned = {
      v: 1,
      id: uuidv4(),
      actorId: identity.playerId,
      seq,
      ts: Date.now(),
      type: params.type,
      payloadPublic: params.payloadPublic,
      payloadOwnerEnc: params.payloadOwnerEnc,
      payloadSpectatorEnc: params.payloadSpectatorEnc,
      payloadRecipientsEnc: params.payloadRecipientsEnc,
      pubKey: identity.signPublicKey,
    };

    const signed = appendCommand({
      commands: params.commands,
      envelope,
      sessionId: params.sessionId,
      playerKey: base64UrlToBytes(playerKey),
      signPrivateKey: identityBytes.signPrivateKey,
    });

    const validation = validateCommand({
      envelope: signed,
      sessionId: params.sessionId,
      playerKey: base64UrlToBytes(playerKey),
      expectedSeq: seq,
      expectedActorId: identity.playerId,
    });

    if (!validation.ok) {
      console.warn(
        "[command-log] appended command failed validation",
        validation,
      );
      const lastIndex = params.commands.length - 1;
      const last = params.commands.get(lastIndex) as CommandEnvelope | undefined;
      if (last?.id === signed.id) {
        params.commands.delete(lastIndex, 1);
      }
      return null;
    }

    return signed;
  } catch (err) {
    console.warn("[command-log] failed to append command", err);
    return null;
  }
};

export const appendPlayerJoinCommand = (params: {
  sessionId: string;
  commands: Y.Array<CommandEnvelope>;
  name?: string;
  color?: string;
}): CommandEnvelope | null => {
  const identity = getOrCreateSessionIdentity(params.sessionId);
  const payloadPublic = {
    playerId: identity.playerId,
    name: params.name,
    color: params.color,
    signPubKey: identity.signPublicKey,
    encPubKey: identity.encPublicKey,
  };

  return appendLocalCommand({
    sessionId: params.sessionId,
    commands: params.commands,
    type: "player.join",
    payloadPublic,
  });
};

export const enqueueLocalCommand = (params: EnqueueLocalCommandParams): void => {
  const previous = commandQueues.get(params.sessionId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const keys = getSessionAccessKeys(params.sessionId);
      const playerKey = keys.playerKey;
      if (!playerKey) {
        console.warn("[command-log] missing playerKey; cannot append command");
        return;
      }

      const identity = getOrCreateSessionIdentity(params.sessionId);
      const identityBytes = getSessionIdentityBytes(params.sessionId);
      const seq = getNextCommandSeq(params.commands, identity.playerId);
      const ts = Date.now();

      let payloads: LocalCommandPayloads;
      try {
        payloads = await params.buildPayloads({
          actorId: identity.playerId,
          seq,
          ts,
        });
      } catch (err) {
        console.warn("[command-log] failed to build command payload", err);
        return;
      }

      const envelope: CommandEnvelopeUnsigned = {
        v: 1,
        id: uuidv4(),
        actorId: identity.playerId,
        seq,
        ts,
        type: params.type,
        payloadPublic: payloads.payloadPublic,
        payloadOwnerEnc: payloads.payloadOwnerEnc,
        payloadSpectatorEnc: payloads.payloadSpectatorEnc,
        payloadRecipientsEnc: payloads.payloadRecipientsEnc,
        pubKey: identity.signPublicKey,
      };

      const signed = appendCommand({
        commands: params.commands,
        envelope,
        sessionId: params.sessionId,
        playerKey: base64UrlToBytes(playerKey),
        signPrivateKey: identityBytes.signPrivateKey,
      });

      const validation = validateCommand({
        envelope: signed,
        sessionId: params.sessionId,
        playerKey: base64UrlToBytes(playerKey),
        expectedSeq: seq,
        expectedActorId: identity.playerId,
      });

      if (!validation.ok) {
        console.warn(
          "[command-log] appended command failed validation",
          validation,
        );
        const lastIndex = params.commands.length - 1;
        const last = params.commands.get(lastIndex) as
          | CommandEnvelope
          | undefined;
        if (last?.id === signed.id) {
          params.commands.delete(lastIndex, 1);
        }
      }
    });

  commandQueues.set(params.sessionId, next);
};
