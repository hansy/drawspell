import { describe, expect, it } from 'vitest';
import { RoomAdmission } from '../connection/roomAdmission';
import { ROOM_TOKENS_KEY, DISCORD_INVITE_METADATA_KEY } from '../domain/constants';
import { ROOM_PROVISION_METADATA_KEY, provisionResponse } from '../rooms/provisioning';
import type { ProvisionRoomRequest } from '@mtg/shared/api/rooms';

const setup = () => {
  const data = new Map<string, unknown>();
  let now = 1000;
  let nextToken = 0;
  const storage = {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    put: async (key: string, value: unknown) => { data.set(key, structuredClone(value)); },
    delete: async (key: string) => { data.delete(key); },
  };
  const admission = new RoomAdmission({ storage, resumeTokenTtlMs: 10000, now: () => now, generateToken: () => `token-${++nextToken}` });
  const payload: ProvisionRoomRequest = {
    roomId: 'test-room', creationId: 'creation-1', activationExpiresAt: 2000,
    request: { spectatorsEnabled: false, players: [{ externalId: 'external-1', deck: { decklist: '1 Sol Ring', bracket: 3 } }, { externalId: 'external-2' }] },
  };
  return { data, admission, payload, storage, setNow: (value: number) => { now = value; } };
};

describe('generic room provisioning and admission', () => {
  it('replays concurrent creations with immutable tokens and no disabled spectator credential', async () => {
    const { admission, payload } = setup();
    const [first, second] = await Promise.all([admission.provision(payload), admission.provision(payload)]);
    expect(second).toEqual(first);
    expect(first.tokens.spectatorToken).toBeUndefined();
    const response = provisionResponse(payload.roomId, 'https://drawspell.space', first);
    expect(response).toMatchObject({ roomId: payload.roomId, spectatorsEnabled: false, activationExpiresAt: new Date(2000).toISOString() });
    expect(response).not.toHaveProperty('spectatorInviteUrl');
    expect(response.players[0].joinUrl).toContain('?invite=');
    expect(JSON.stringify(response)).not.toContain('Sol Ring');
    await expect(admission.provision({ ...payload, request: { ...payload.request, spectatorsEnabled: true } })).rejects.toMatchObject({ status: 409 });
    await expect(admission.provision({ ...payload, creationId: 'other' })).rejects.toMatchObject({ status: 409 });
  });

  it('rejects expired creation and never resurrects deleted metadata on retry', async () => {
    const { admission, payload, setNow, data } = setup();
    await admission.provision(payload);
    setNow(2000);
    expect(await admission.provisionExists(payload.creationId)).toBe(false);
    await expect(admission.provision(payload)).rejects.toMatchObject({ status: 410 });
    data.clear(); admission.clearCache();
    await expect(admission.provision(payload)).rejects.toMatchObject({ status: 410 });
    expect(data.size).toBe(0);
  });

  it('activates only for a player and retains an activated room beyond its invitation deadline', async () => {
    const { admission, payload, setNow } = setup();
    payload.request.spectatorsEnabled = true;
    const metadata = await admission.provision(payload);
    await admission.resolveConnectionAuthWithResume({ viewerRole: 'spectator', token: metadata.tokens.spectatorToken }, metadata.tokens, { allowTokenCreation: false });
    setNow(2000);
    expect(await admission.provisionExists(payload.creationId)).toBe(false);
    setNow(1500);
    const result = await admission.resolveConnectionAuthWithResume({ playerId: 'p1', token: metadata.tokens.playerToken }, metadata.tokens, { allowTokenCreation: false });
    expect(result.ok).toBe(true);
    setNow(3000);
    expect(await admission.provisionExists(payload.creationId)).toBe(true);
    expect(await admission.provisionExists('other')).toBe(false);
    expect((await admission.provision(payload)).tokens).toEqual(metadata.tokens);
  });

  it('does not overwrite ordinary app or legacy Discord rooms', async () => {
    for (const legacy of [false, true]) {
      const { admission, payload, data } = setup();
      if (legacy) data.set(DISCORD_INVITE_METADATA_KEY, { source: 'discord' });
      else await admission.ensureRoomTokens();
      await expect(admission.provision(payload)).rejects.toMatchObject({ status: 409 });
      expect(data.has(ROOM_PROVISION_METADATA_KEY)).toBe(false);
    }
  });

  it('reserves normal sync initialization against racing API creation', async () => {
    const { admission, payload } = setup();
    await admission.resolveConnectionAuthWithResume({ playerId: 'normal' }, null, { allowTokenCreation: false });
    await expect(admission.provision(payload)).rejects.toMatchObject({ status: 409 });
  });

  it('recovers stable credentials from durable metadata after an interrupted compatibility write', async () => {
    const { admission, payload, data } = setup();
    const first = await admission.provision(payload);
    data.delete(ROOM_TOKENS_KEY); admission.clearCache();
    expect(await admission.loadRoomTokens()).toEqual(first.tokens);
    expect(await admission.provision(payload)).toEqual(first);
  });

  it('rejects spectator roles with player, resume or personal credentials on either channel', async () => {
    const { admission, payload } = setup();
    const metadata = await admission.provision(payload);
    const resumeToken = await admission.ensurePlayerResumeToken('p1');
    for (const channel of ['intent', 'sync'] as const) {
      for (const credentials of [{ token: metadata.tokens.playerToken }, { resumeToken }, { invite: metadata.assignments[0].token }]) {
        const result = await admission.resolveConnectionAuthWithResume({ channel, playerId: 'p1', viewerRole: 'spectator', ...credentials }, metadata.tokens, { allowTokenCreation: channel === 'intent' });
        expect(result.ok).toBe(false);
      }
    }
  });

  it('personal invites authorize ordinary entry and supply only the matching assignment once per player', async () => {
    const { admission, payload, data } = setup();
    const metadata = await admission.provision(payload);
    const invite = metadata.assignments[0].token;
    const auth = await admission.resolveConnectionAuthWithResume({ playerId: 'p1', invite }, metadata.tokens, { allowTokenCreation: true });
    expect(auth).toMatchObject({ ok: true, token: metadata.tokens.playerToken, resolvedRole: 'player' });
    expect(await admission.takePreload('p1', invite, false)).toEqual({ assignmentId: metadata.assignments[0].assignmentId, decklist: '1 Sol Ring', bracket: 3 });
    admission.clearCache();
    expect(await admission.takePreload('p1', invite, false)).toBeNull();
    expect(await admission.takePreload('p2', metadata.assignments[1].token, false)).toBeNull();
    expect(await admission.takePreload('p3', invite, true)).toBeNull();
    expect(await admission.takePreload('p3', invite, false)).toBeNull();
    expect(await admission.resolveConnectionAuthWithResume({ playerId: 'p4', invite: 'forged' }, metadata.tokens, { allowTokenCreation: true })).toMatchObject({ ok: false });
    expect(data.get(ROOM_PROVISION_METADATA_KEY)).toMatchObject({ request: payload.request });
  });

  it('compatibility Discord provisioning is serialized and cannot overwrite normal or API rooms', async () => {
    const legacy = { interactionId: 'interaction', guildId: 'guild', channelId: 'channel', invokerDiscordUserId: 'user', participantDiscordUserIds: ['user'], inviteExpiresAt: 2000 };
    const api = setup();
    await api.admission.provision(api.payload);
    await expect(api.admission.provisionLegacyDiscord('test-room', legacy)).rejects.toMatchObject({ status: 409 });
    const normal = setup();
    await normal.admission.ensureRoomTokens();
    await expect(normal.admission.provisionLegacyDiscord('test-room', legacy)).rejects.toMatchObject({ status: 409 });
    const fresh = setup();
    const [first, retry] = await Promise.all([fresh.admission.provisionLegacyDiscord('test-room', legacy), fresh.admission.provisionLegacyDiscord('test-room', legacy)]);
    expect(first.alreadyProvisioned).toBe(false);
    expect(retry).toEqual({ ...first, alreadyProvisioned: true });
    await expect(fresh.admission.provision(fresh.payload)).rejects.toMatchObject({ status: 409 });
    fresh.data.delete(ROOM_TOKENS_KEY); fresh.admission.clearCache();
    expect((await fresh.admission.provisionLegacyDiscord('test-room', legacy)).playerToken).toBe(first.playerToken);
    await expect(fresh.admission.provisionLegacyDiscord('test-room', { ...legacy, interactionId: 'other' })).rejects.toMatchObject({ status: 409 });
  });

  it('keeps previously issued legacy Discord invitations working', async () => {
    const { admission, data } = setup();
    const tokens = { playerToken: 'legacy-player', spectatorToken: 'legacy-spectator' };
    data.set(ROOM_TOKENS_KEY, tokens);
    data.set(DISCORD_INVITE_METADATA_KEY, { source: 'discord', interactionId: 'legacy', inviteExpiresAt: 2000 });
    expect(await admission.resolveConnectionAuthWithResume({ playerId: 'p1', token: 'legacy-player' }, tokens, { allowTokenCreation: true })).toMatchObject({ ok: true });
    expect(data.get(DISCORD_INVITE_METADATA_KEY)).toMatchObject({ inviteActivatedAt: 1000 });
  });
});
