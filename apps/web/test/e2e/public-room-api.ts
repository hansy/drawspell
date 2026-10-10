import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium, type Page } from 'playwright-core';

// Run the local web and room Workers with matching JOIN_TOKEN_SECRET and
// ROOM_PROVISION_SECRET. Apply web D1 migrations and set AUTH_TEST_SECRET in
// web .dev.vars to capture local magic links instead of delivering email.
const origin = process.env.E2E_WEB_ORIGIN ?? 'https://ds.localhost';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const email = `drawspell-e2e-${crypto.randomUUID()}@example.test`;
const assertions: string[] = [];
function checked(name: string) { assertions.push(name); console.log(`PASS ${name}`); }
function localMagicLink(): string | null {
  const state = join(process.cwd(), '.wrangler/state');
  for (const entry of readdirSync(state, { recursive: true })) {
    if (typeof entry !== 'string' || !entry.endsWith('.sqlite')) continue;
    const db = new DatabaseSync(join(state, entry), { readOnly: true });
    try {
      const row = db.prepare('SELECT url FROM developer_test_mail WHERE email = ?').get(email) as { url: string } | null;
      if (row?.url) return row.url;
    } catch { /* Other Worker databases do not contain the local mail outbox. */ }
    finally { db.close(); }
  }
  return null;
}
function setAccountSuspended(suspended: boolean) {
  const state = join(process.cwd(), '.wrangler/state');
  for (const entry of readdirSync(state, { recursive: true })) {
    if (typeof entry !== 'string' || !entry.endsWith('.sqlite')) continue;
    const db = new DatabaseSync(join(state, entry));
    try {
      const result = db.prepare('UPDATE developer_accounts SET suspended = ? WHERE developer_id IN (SELECT id FROM developer_user WHERE email = ?)').run(Number(suspended), email);
      if (result.changes) return;
    } catch { /* Other Worker databases do not contain this account. */ }
    finally { db.close(); }
  }
  throw new Error('Local test account not found');
}
async function joinPlayer(target: Page, url: string, name: string) {
  await target.goto(url);
  await target.getByRole('textbox', { name: 'Username', exact: true }).fill(name);
  await target.getByRole('button', { name: 'Continue', exact: true }).click();
  await target.waitForFunction(async () => {
    const path = '/src/store/gameStore.ts';
    const state = (await import(path)).useGameStore.getState();
    return !!state.players[state.myPlayerId];
  }, undefined, { timeout: 30_000 });
}
try {
  const protectedPage = await context.request.get(`${origin}/developers`, { maxRedirects: 0 });
  assert.equal(protectedPage.status(), 303);
  assert.equal(new URL(protectedPage.headers().location, origin).pathname, '/auth/login');
  assert(!/Developer API keys|Create key/.test(await protectedPage.text()));
  assert.equal((await context.request.get(`${origin}/api/auth/developer/keys`)).status(), 401);
  for (const [oldPath, nextPath] of [['/developer', '/developers'], ['/developer/login', '/auth/login']]) {
    const alias = await context.request.get(`${origin}${oldPath}`, { maxRedirects: 0 });
    assert.equal(alias.status(), 308);
    assert.equal(new URL(alias.headers().location, origin).pathname, nextPath);
  }
  checked('server redirects protected and legacy pages before rendering; unauthenticated key API returns 401');
  const noJsContext = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false });
  const noJs = await noJsContext.newPage();
  await noJs.goto(`${origin}/developers`);
  assert.equal(new URL(noJs.url()).pathname, '/auth/login');
  await noJs.getByRole('heading', { name: 'Sign in to Drawspell', exact: true }).waitFor();
  assert(!/We’ll email|No password|Developer API keys/.test(await noJs.locator('main').innerText()));
  for (const path of ['/', '/docs', '/auth/login', '/privacy', '/tos', '/page-that-does-not-exist', '/developers/missing']) {
    const response = await noJs.goto(`${origin}${path}`);
    assert.equal(response?.status(), ['/page-that-does-not-exist', '/developers/missing'].includes(path) ? 404 : 200);
    assert.equal(await noJs.getByRole('banner').getByRole('link', { name: 'Drawspell', exact: true }).count(), 1);
    await noJs.getByRole('contentinfo').getByRole('link', { name: 'API', exact: true }).waitFor();
  }
  await noJs.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
  await noJsContext.close();
  checked('shared navigation, login, redirect and real 404 render without JavaScript');
  await page.goto(`${origin}/developers`);
  await page.waitForURL('**/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  const sendResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/magic-link');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  const sent = await sendResponse;
  assert.equal(sent.status(), 200, 'Magic-link submission must succeed');
  await page.waitForFunction(() => !!document.querySelector('[role=status]')?.textContent?.trim());
  assert.match(await page.getByRole('status').innerText(), /Check your email/);
  const magicLink = localMagicLink();
  assert(magicLink, 'Local magic link was not captured');
  checked('magic-link email captured locally');
  await page.goto(magicLink);
  await page.waitForURL('**/developers');
  checked('magic-link consumed and developer session established');
  await page.getByLabel('Key name', { exact: true }).fill('Browser E2E');
  const keyResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/developer/keys' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create key', exact: true }).click();
  assert.equal((await keyResponse).status(), 201, 'Named key creation failed');
  await page.getByRole('heading', { name: 'Copy your new API key' }).waitFor();
  const apiKey = (await page.locator('section code').innerText()).trim();
  assert(apiKey.length > 20);
  checked('magic-link login and API-key issuance through developer UI');
  const authenticatedHtml = await context.request.get(`${origin}/developers`);
  assert.equal(authenticatedHtml.status(), 200);
  assert.match(authenticatedHtml.headers()['cache-control'], /no-store/);
  assert.match(await authenticatedHtml.text(), /Browser E2E/);
  checked('authenticated dashboard and key list rendered on server with no-store headers');
  await page.getByRole('button', { name: 'I saved this key' }).click();
  assert.equal(await page.locator('section code').count(), 0);
  checked('API secret shown only on creation');
  const create = (key: string, body: unknown, credential = apiKey) => context.request.post(`${origin}/api/v1/rooms`, {
    headers: { Authorization: `Bearer ${credential}`, 'Idempotency-Key': key }, data: body,
  });
  assert.equal((await create(crypto.randomUUID(), {}, 'invalid')).status(), 401);
  checked('invalid API credential rejected');
  const key = crypto.randomUUID();
  const request = { spectatorsEnabled: false, players: [
    { externalId: 'alice', deck: { decklist: '1 Sol Ring\n1 Command Tower', bracket: 3 } },
    { externalId: 'bob' },
  ] };
  const response = await create(key, request);
  assert.equal(response.status(), 201, `Create status ${response.status()}: ${await response.text()}`);
  const room = await response.json();
  assert.equal(room.spectatorsEnabled, false);
  assert(!('spectatorInviteUrl' in room));
  assert.equal(room.players.length, 2);
  const replay = await create(key, request);
  assert.equal(replay.status(), 200);
  assert.equal(replay.headers()['idempotency-replayed'], 'true');
  assert.deepEqual(await replay.json(), room);
  assert.equal((await create(key, {})).status(), 409);
  checked('room creation, personal invitations, stable replay and conflict');
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  owner.setDefaultTimeout(30_000);
  await joinPlayer(owner, room.players[0].joinUrl, 'Preloaded Alice');
  await owner.waitForFunction(async () => {
    const path = '/src/store/gameStore.ts';
    const state = (await import(path)).useGameStore.getState();
    return state.players[state.myPlayerId]?.deckLoaded && state.players[state.myPlayerId]?.libraryCount === 2;
  }, undefined, { timeout: 60_000 });
  checked('personal invitation automatically imports real deck through room server');
  const share = await owner.evaluate(async () => {
    const path = '/src/partykit/shareLinksClient.ts';
    return (await import(path)).requestShareLinks();
  });
  assert(!('spectatorInviteUrl' in share));
  const tokens = await owner.evaluate((id) => JSON.parse(localStorage.getItem(`drawspell:roomTokens:${id}`) ?? '{}'), room.roomId);
  assert(!tokens.spectatorToken);
  checked('disabled spectator credentials absent from player token and share responses');
  const spectatorDenials = await owner.evaluate(async (room) => {
    const tokenPath = '/src/server/joinToken.ts';
    const { token } = await (await import(tokenPath)).getJoinToken({ data: { roomId: room.roomId } });
    const originPath = '/src/lib/runtimeOrigins.ts';
    const host = (await import(originPath)).resolveOriginsForEnv('development').server;
    return Promise.all(['sync', 'intent'].map(role => new Promise<{code: number; received: boolean}>((resolve, reject) => {
      const url = new URL(`/parties/rooms/${room.roomId}`, host.replace(/^http/, 'ws'));
      url.search = new URLSearchParams({ role, gt: new URL(room.playerInviteUrl).searchParams.get('gt')!, viewerRole: 'spectator', playerId: crypto.randomUUID(), jt: token }).toString();
      const socket = new WebSocket(url);
      let received = false;
      const timer = setTimeout(() => { socket.close(); reject(new Error('Spectator attempt was not rejected')); }, 10_000);
      socket.onmessage = () => { received = true; };
      socket.onclose = event => { clearTimeout(timer); resolve({ code: event.code, received }); };
    })));
  }, room);
  assert(spectatorDenials.every(result => result.code !== 1000 && !result.received));
  checked('player credential cannot bypass disabled spectators on either WebSocket channel');
  await owner.waitForFunction(async () => {
    const path = '/src/logging/logStore.ts';
    return (await import(path)).useLogStore.getState().entries.filter((entry: {eventId: string}) => entry.eventId === 'deck.load').length === 1;
  });
  checked('successful preload emits the generic server deck-load event');
  await owner.reload();
  await owner.waitForFunction(async () => {
    const path = '/src/store/gameStore.ts';
    const state = (await import(path)).useGameStore.getState();
    return state.players[state.myPlayerId]?.libraryCount === 2;
  });
  checked('reconnect preserves loaded deck without duplicate cards');
  const guestContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const guest = await guestContext.newPage();
  await joinPlayer(guest, room.playerInviteUrl, 'Shared Guest');
  const guestState = await guest.evaluate(async () => {
    const gamePath = '/src/store/gameStore.ts';
    const preloadPath = '/src/store/preloadDeckStore.ts';
    const state = (await import(gamePath)).useGameStore.getState();
    return { loaded: !!state.players[state.myPlayerId]?.deckLoaded, preload: (await import(preloadPath)).usePreloadDeckStore.getState().pending };
  });
  assert.equal(guestState.loaded, false);
  assert.equal(guestState.preload, null);
  checked('shared player can join without receiving another player’s assignment');
  const normal = await create(crypto.randomUUID(), {});
  assert.equal(normal.status(), 201);
  const normalRoom = await normal.json();
  assert.equal(normalRoom.spectatorsEnabled, true);
  assert(normalRoom.spectatorInviteUrl);
  checked('spectators remain enabled by default');
  const badResponse = await create(crypto.randomUUID(), { players: [{ externalId: 'bad', deck: { decklist: '1 zzzNoSuchDrawspellCardXYZ987654' } }] });
  assert.equal(badResponse.status(), 201);
  const badRoom = await badResponse.json();
  const badContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const bad = await badContext.newPage();
  await joinPlayer(bad, badRoom.players[0].joinUrl, 'Invalid Deck');
  await bad.waitForFunction(() => [...document.querySelectorAll('textarea')].some(el => el.value.includes('zzzNoSuchDrawspellCardXYZ987654')), undefined, { timeout: 60_000 });
  await bad.waitForFunction(() => /missing|not found|could not|unable|no valid/i.test(document.body.innerText), undefined, { timeout: 60_000 });
  checked('unknown cards accepted at creation and handled by normal join-time import UI');
  await page.goto(`${origin}/docs`);
  await page.getByRole('heading', { name: 'Drawspell API', exact: true }).waitFor();
  checked('public API docs render');
  await page.goto(`${origin}/developers`);
  await page.getByRole('button', { name: 'Revoke', exact: true }).click();
  await page.getByText('revoked', { exact: false }).waitFor();
  assert.equal((await create(crypto.randomUUID(), {})).status(), 401);
  checked('revoked API key immediately loses room-creation access');
  setAccountSuspended(true);
  try {
    const suspended = await context.request.get(`${origin}/developers`);
    assert.equal(suspended.status(), 403);
    assert.match(await suspended.text(), /Developer access is disabled/);
    assert(!/Create key/.test(await suspended.text()));
    assert.equal((await context.request.get(`${origin}/api/auth/developer/keys`)).status(), 403);
  } finally { setAccountSuspended(false); }
  checked('suspended accounts receive server-rendered 403 without dashboard data');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/auth/login');
  const afterLogout = await context.request.get(`${origin}/developers`, { maxRedirects: 0 });
  assert.equal(afterLogout.status(), 303);
  assert(!/Developer API keys|Create key/.test(await afterLogout.text()));
  assert.equal((await context.request.get(`${origin}/api/auth/developer/keys`)).status(), 401);
  checked('sign-out invalidates server access before protected page rendering');
  console.log(`${assertions.length} end-to-end checks passed`);
} finally {
  await browser.close();
}
