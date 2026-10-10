import { codeToHtml } from 'shiki';
import { mkdir, writeFile } from 'node:fs/promises';

const body = JSON.stringify({
  spectatorsEnabled: false,
  players: [{ externalId: 'player-1', deck: { decklist: '1 Sol Ring\n1 Command Tower', bracket: 3 } }],
}, null, 2);
const examples = [
  {
    label: 'cURL', lang: 'bash',
    code: `curl https://drawspell.space/api/v1/rooms \\
  -H "Authorization: Bearer $DRAWSPELL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: match-123" \\
  --data '${body}'`,
  },
  {
    label: 'JavaScript', lang: 'javascript',
    code: `const response = await fetch(
  'https://drawspell.space/api/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${process.env.DRAWSPELL_API_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'match-123',
    },
    body: JSON.stringify(${body.replaceAll('\n', '\n    ')}),
  },
);

const room = await response.json();
if (!response.ok) throw new Error(room.error.message);
// Send room.players[0].joinUrl to player-1.`,
  },
  {
    label: 'Response', lang: 'json',
    code: JSON.stringify({
      roomId: 'abc123', spectatorsEnabled: false,
      activationExpiresAt: '2026-10-09T18:10:00.000Z',
      playerInviteUrl: 'https://drawspell.space/rooms/abc123?gt=…',
      players: [{externalId: 'player-1',joinUrl: 'https://drawspell.space/rooms/abc123?invite=…'}],
    }, null, 2),
  },
  {
    label: 'Error', lang: 'json',
    code: JSON.stringify({error: {code: 'idempotency_conflict', message: 'This Idempotency-Key was already used with different content.'}}, null, 2),
  },
];
// Only static examples become HTML. Shiki never ships to the browser.
const highlighted = await Promise.all(examples.map(async example => ({
  ...example,
  html: await codeToHtml(example.code, {lang: example.lang, theme: 'github-dark'}),
})));
const directory = new URL('../src/generated/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('doc-examples.json', directory), JSON.stringify(highlighted, null, 2) + '\n');
