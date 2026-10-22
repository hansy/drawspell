import { expect, test } from 'bun:test';
import { assessAdvisories, parseAuditOutput } from './audit-dependencies.mjs';

const issue = (severity = 'high', id = 'GHSA-aaaa-bbbb-cccc') => ({ title: 'Synthetic advisory', severity, url: `https://github.com/advisories/${id}` });
test('blocks high and critical findings across all packages', () => {
  expect(assessAdvisories({ first: [issue()], second: [issue('critical')] }).blocking).toHaveLength(2);
});
test('retains lower-severity findings in the report', () => {
  const result = assessAdvisories({ example: [issue('moderate'), issue('low')] });
  expect(result.blocking).toHaveLength(0);
  expect(result.lower).toHaveLength(2);
});
test('a verified fix is limited to its package and advisory', () => {
  const result = assessAdvisories({ fixed: [issue(), issue('high', 'GHSA-dddd-eeee-ffff')], other: [issue()] }, new Set(['fixed:GHSA-aaaa-bbbb-cccc']));
  expect(result.remediated).toHaveLength(1);
  expect(result.blocking).toHaveLength(2);
});
test('fails closed on invalid registry responses and failed empty audits', () => {
  for (const value of ['not JSON', '{"error":"registry unavailable"}', '[]']) expect(() => parseAuditOutput(value, 1)).toThrow();
  expect(() => parseAuditOutput('{}', 1)).toThrow();
  expect(() => parseAuditOutput('{}', null)).toThrow();
  expect(parseAuditOutput('{}', 0)).toEqual({});
});
test('rejects malformed advisories instead of treating them as clean', () => {
  expect(() => assessAdvisories({ example: [{ ...issue(), severity: 'unknown' }] })).toThrow();
  expect(() => assessAdvisories({ example: [{ ...issue(), url: 'https://example.invalid' }] })).toThrow();
});

test('rejects altered patches, undeclared patches, and other resolved versions', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { verifiedPatchAdvisories } = await import('./audit-dependencies.mjs');
  const root = mkdtempSync(join(tmpdir(), 'audit-gate-'));
  try {
    mkdirSync(join(root, 'security'));
    mkdirSync(join(root, 'patches'));
    const patch = 'synthetic patch bytes';
    writeFileSync(join(root, 'patches/fix.patch'), patch);
    const entry = { package: 'braces', version: '3.0.3', patch: 'patches/fix.patch', sha256: 'wrong', advisories: ['GHSA-aaaa-bbbb-cccc'], reason: 'Synthetic regression', upstream: 'https://example.invalid' };
    const save = () => writeFileSync(join(root, 'security/dependency-patches.json'), JSON.stringify({ patches: [entry] }));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ patchedDependencies: { 'braces@3.0.3': entry.patch } }));
    writeFileSync(join(root, 'bun.lock'), '{"packages":{"braces":["braces@3.0.3"],"old/braces":["braces@3.0.2"]}}');
    save();
    expect(() => verifiedPatchAdvisories(root)).toThrow('checksum mismatch');
    entry.sha256 = createHash('sha256').update(patch).digest('hex');
    save();
    expect(() => verifiedPatchAdvisories(root)).toThrow('Unpatched package version');
    writeFileSync(join(root, 'package.json'), '{}');
    expect(() => verifiedPatchAdvisories(root)).toThrow('not installed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
