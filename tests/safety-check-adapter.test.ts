import { describe, expect, it } from 'vitest';
import { buildFailedSafetyCheck, buildFriendlySafetyCheck } from '../src/carousel/safetyCheck';

describe('safety-check adapter', () => {
  it('returns friendly fields only for passing dry-run', () => {
    const result = buildFriendlySafetyCheck({
      dryRun: true,
      targetProfileId: 'profile_2',
      backupPlan: [{}],
      restorePlan: [{}],
      warnings: [],
    }, 'profile_2');

    expect(result.ok).toBe(true);
    expect(result.canSwitch).toBe(true);
    expect(result.checks.map((c) => c.label)).toEqual([
      'Current account backup',
      'Target account saved login',
      'Codex status',
      'Setup',
      'Result',
    ]);
    expect(JSON.stringify(result)).not.toContain('rollbackPlan');
    expect(JSON.stringify(result)).not.toContain('fixtureRootDir');
    expect(JSON.stringify(result)).not.toContain('switch.lock');
  });

  it('maps Codex running and setup warnings to friendly output', () => {
    const result = buildFriendlySafetyCheck({
      dryRun: true,
      targetProfileId: 'profile_2',
      backupPlan: [{}],
      restorePlan: [],
      warnings: ['Codex appears to be running. Close Codex manually before capture/switch.', 'codexProfileRootPath is not configured'],
    }, 'profile_2');

    expect(result.canSwitch).toBe(false);
    expect(result.warnings).toContain('Codex appears to be open. Close it before switching.');
    expect(result.warnings.some((w) => /setup is incomplete/i.test(w))).toBe(true);
  });

  it('returns friendly failed payload when adapter receives an error', () => {
    const result = buildFailedSafetyCheck('profile_2', new Error('Some stack-ish failure: at line 44'));
    expect(result.ok).toBe(false);
    expect(result.canSwitch).toBe(false);
    expect(result.checks.at(-1)?.detail).toBe('Fix setup first.');
  });
});

