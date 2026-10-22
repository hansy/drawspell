import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifySecurityPatches } from './security-regressions.mjs';

const ranks = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function assessAdvisories(report, patched = new Set()) {
  if (!isRecord(report)) throw new Error('Audit response is not an advisory report');
  const blocking = [], remediated = [], lower = [];
  for (const [name, advisories] of Object.entries(report)) {
    if (!Array.isArray(advisories)) throw new Error(`Invalid advisory list for ${name}`);
    for (const advisory of advisories) {
      if (!isRecord(advisory) || typeof advisory.title !== 'string' || !Object.hasOwn(ranks, advisory.severity) || typeof advisory.url !== 'string') throw new Error(`Invalid advisory for ${name}`);
      const id = advisory.url.match(/^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9-]+)$/)?.[1];
      if (!id) throw new Error(`Unrecognized advisory identity for ${name}`);
      const item = { ...advisory, package: name, id };
      if (patched.has(`${name}:${id}`)) remediated.push(item);
      else if (ranks[advisory.severity] >= ranks.high) blocking.push(item);
      else lower.push(item);
    }
  }
  return { blocking, remediated, lower };
}

export function parseAuditOutput(stdout, status) {
  let report;
  try { report = JSON.parse(stdout); } catch { throw new Error('Dependency audit did not return valid JSON'); }
  const assessment = assessAdvisories(report);
  if (status !== 0 && Object.values(assessment).every((items) => items.length === 0)) throw new Error('Dependency audit failed without an advisory report');
  if (status !== 0 && status !== 1) throw new Error(`Dependency audit failed with status ${status}`);
  return report;
}

export function verifiedPatchAdvisories(root) {
  const policyPath = resolve(root, 'security/dependency-patches.json');
  if (!existsSync(policyPath)) return new Set();
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (!Array.isArray(policy.patches)) throw new Error('Invalid dependency patch policy');
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = readFileSync(resolve(root, 'bun.lock'), 'utf8');
  const allowed = new Set(), packages = new Set();
  for (const entry of policy.patches) {
    if (!isRecord(entry) || typeof entry.package !== 'string' || typeof entry.version !== 'string' || typeof entry.patch !== 'string' || typeof entry.sha256 !== 'string' || !Array.isArray(entry.advisories) || !entry.reason || !entry.upstream) throw new Error('Incomplete dependency patch policy');
    const path = resolve(root, entry.patch);
    if (!path.startsWith(root + sep)) throw new Error('Patch must be inside the repository');
    if (manifest.patchedDependencies?.[`${entry.package}@${entry.version}`] !== entry.patch) throw new Error(`Patch is not installed for ${entry.package}`);
    if (createHash('sha256').update(readFileSync(path)).digest('hex') !== entry.sha256) throw new Error(`Patch checksum mismatch for ${entry.package}`);
    const escaped = entry.package.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const versions = [...lock.matchAll(new RegExp('\\[\\s*"' + escaped + '@([^" ]+)"', 'g'))].map((match) => match[1]);
    if (!versions.length || versions.some((version) => version !== entry.version)) throw new Error(`Unpatched package version found for ${entry.package}`);
    for (const id of entry.advisories) {
      if (typeof id !== 'string' || !/^GHSA-[a-z0-9-]+$/.test(id) || allowed.has(`${entry.package}:${id}`)) throw new Error('Invalid or duplicated patched advisory');
      allowed.add(`${entry.package}:${id}`);
    }
    packages.add(entry.package);
  }
  verifySecurityPatches(root, packages);
  return allowed;
}

if (import.meta.main) {
  try {
    if (!process.versions.bun) throw new Error('Run this script with Bun');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const patched = verifiedPatchAdvisories(root);
    const result = spawnSync(process.execPath, ['audit', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 120000 });
    if (result.error || result.signal) throw new Error('Dependency audit could not complete');
    const report = parseAuditOutput(result.stdout, result.status);
    const assessment = assessAdvisories(report, patched);
    if (process.env.AUDIT_REPORT_PATH) writeFileSync(process.env.AUDIT_REPORT_PATH, JSON.stringify({ bun: process.versions.bun, policy: 'Block unpatched high and critical advisories across the entire lockfile', ...assessment, report }, null, 2) + '\n');
    for (const advisory of assessment.blocking) console.error(`${advisory.severity}: ${advisory.package} - ${advisory.title}\n${advisory.url}`);
    console.log(`Dependency audit: ${assessment.blocking.length} blocking high/critical, ${assessment.remediated.length} verified locally patched, ${assessment.lower.length} lower-severity advisories.`);
    process.exitCode = assessment.blocking.length ? 1 : 0;
  } catch (error) {
    console.error(typeof error?.message === 'string' ? error.message : String(error));
    process.exitCode = 1;
  }
}
