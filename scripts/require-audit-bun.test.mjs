import { describe, expect, test } from 'bun:test';

import { auditBunProblem } from './require-audit-bun.mjs';

describe('audit Bun version guard', () => {
  test('accepts the pinned Bun and anything newer', () => {
    expect(auditBunProblem('1.4.4', 'bun@1.4.4')).toBeUndefined();
    expect(auditBunProblem('1.4.10', 'bun@1.4.4')).toBeUndefined();
    expect(auditBunProblem('2.0.0', 'bun@1.4.4')).toBeUndefined();
  });

  test('refuses an older Bun that can mistake registry errors for a clean audit', () => {
    expect(auditBunProblem('1.3.14', 'bun@1.4.4')).toContain('bun upgrade');
    expect(auditBunProblem('1.4.3', 'bun@1.4.4')).toContain('1.4.4');
  });

  test('requires an exact pinned version', () => {
    expect(auditBunProblem('1.4.4', undefined)).toContain('packageManager');
    expect(auditBunProblem('1.4.4', 'bun@^1.4.0')).toContain('packageManager');
  });
});
