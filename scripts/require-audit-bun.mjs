import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Older Bun (1.3.14) can report success when the registry returns an error object,
// so the audit refuses to vouch for anything unless it runs on the pinned Bun.
export function auditBunProblem(running, packageManager) {
  const required = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager ?? '')?.[1];
  if (!required) return 'package.json must pin packageManager to an exact bun@x.y.z';
  const parts = (version) => version.split('-')[0].split('.').map(Number);
  const [have, need] = [parts(running), parts(required)];
  for (let index = 0; index < 3; index += 1) {
    if (have[index] > need[index]) return undefined;
    if (have[index] < need[index]) {
      return `Bun ${running} cannot be trusted to audit; run \`bun upgrade\` to at least ${required}`;
    }
  }
  return undefined;
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const problem = auditBunProblem(Bun.version, manifest.packageManager);
  if (problem) {
    console.error(problem);
    process.exitCode = 1;
  }
}
