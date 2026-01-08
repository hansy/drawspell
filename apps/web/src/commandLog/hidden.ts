import type { Card } from "@/types";

import { base64UrlToBytes } from "@/crypto/base64url";
import { getSessionAccessKeys } from "@/lib/sessionKeys";
import { getSessionIdentityBytes } from "@/lib/sessionIdentity";
import { ZONE } from "@/constants/zones";

import { deriveOwnerAesKey, deriveSpectatorAesKey, encryptJsonPayload } from "./crypto";
import { extractCardIdentity } from "./identity";

export const buildHiddenZonePayloads = async (params: {
  sessionId: string;
  ownerId: string;
  zoneType: string;
  cards: Card[];
  order: string[];
}): Promise<{
  payloadPublic: { ownerId: string; zoneType: string; count: number };
  payloadOwnerEnc: string;
  payloadSpectatorEnc?: string;
}> => {
  const identityBytes = getSessionIdentityBytes(params.sessionId);
  const ownerKey = deriveOwnerAesKey({
    ownerKey: identityBytes.ownerKey,
    sessionId: params.sessionId,
  });

  const payloadPublic = {
    ownerId: params.ownerId,
    zoneType: params.zoneType,
    count: params.order.length,
  };

  const payloadOwnerEnc = await encryptJsonPayload(ownerKey, {
    cards: params.cards,
    order: params.order,
  });

  let payloadSpectatorEnc: string | undefined;
  if (params.zoneType === ZONE.HAND) {
    const keys = getSessionAccessKeys(params.sessionId);
    if (keys.spectatorKey) {
      const spectatorKey = deriveSpectatorAesKey({
        spectatorKey: base64UrlToBytes(keys.spectatorKey),
        sessionId: params.sessionId,
      });
      payloadSpectatorEnc = await encryptJsonPayload(spectatorKey, {
        cards: params.cards,
        order: params.order,
      });
    }
  }

  return { payloadPublic, payloadOwnerEnc, payloadSpectatorEnc };
};

export const buildHiddenOrderPayloads = async (params: {
  sessionId: string;
  ownerId: string;
  zoneType: string;
  order: string[];
}): Promise<{
  payloadPublic: { ownerId: string; count: number };
  payloadOwnerEnc: string;
}> => {
  const identityBytes = getSessionIdentityBytes(params.sessionId);
  const ownerKey = deriveOwnerAesKey({
    ownerKey: identityBytes.ownerKey,
    sessionId: params.sessionId,
  });

  const payloadPublic = {
    ownerId: params.ownerId,
    count: params.order.length,
  };

  const payloadOwnerEnc = await encryptJsonPayload(ownerKey, {
    order: params.order,
  });

  return { payloadPublic, payloadOwnerEnc };
};

export const buildLibraryTopRevealPayload = (params: {
  ownerId: string;
  order: string[];
  cardsById: Record<string, Card>;
}): {
  payloadPublic: {
    ownerId: string;
    mode: "all";
    cardId?: string;
    identity?: Partial<Card>;
  };
} => {
  const topId = params.order[params.order.length - 1];
  const topCard = topId ? params.cardsById[topId] : undefined;
  return {
    payloadPublic: {
      ownerId: params.ownerId,
      mode: "all",
      cardId: topCard?.id,
      identity: topCard ? extractCardIdentity(topCard) : undefined,
    },
  };
};
