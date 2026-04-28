export type FriendlyCheckStatus = 'Ready' | 'Warning' | 'Failed' | 'Unknown';

export type FriendlySafetyCheck = {
  ok: boolean;
  targetProfileId: string;
  checks: Array<{
    label: 'Current account backup' | 'Target account saved login' | 'Codex status' | 'Setup' | 'Result';
    status: FriendlyCheckStatus;
    detail: string;
  }>;
  canSwitch: boolean;
  warnings: string[];
};

type DryRunLike = {
  dryRun?: boolean;
  targetProfileId?: string;
  backupPlan?: unknown[];
  restorePlan?: unknown[];
  warnings?: string[];
};

function toFriendlyWarning(input: string): string {
  const value = String(input || '').replace(/^Error:\s*/i, '').trim();
  if (!value) return 'Unknown issue while running Safety Check.';

  if (/codex appears to be running/i.test(value) || /codex process appears to be running/i.test(value)) {
    return 'Codex appears to be open. Close it before switching.';
  }
  if (/local switching is disabled/i.test(value) || /codexProfileRootPath is not configured/i.test(value) || /configured codexProfileRootPath does not exist/i.test(value) || /setup profile root/i.test(value)) {
    return 'Setup is incomplete. Open Settings and complete setup before switching.';
  }
  if (/target profile has no captured snapshotPath/i.test(value) || /target snapshotPath does not exist/i.test(value)) {
    return 'Target account login is missing. Re-save this account login before switching.';
  }
  if (/backend storage is not writable/i.test(value)) {
    return 'Local storage is not writable. Fix storage permissions and try again.';
  }
  if (/switch lock exists/i.test(value)) {
    return 'Another switch check is active. Wait a moment and run Safety Check again.';
  }

  return 'Safety Check found an issue. Review setup and try again.';
}

export function buildFriendlySafetyCheck(payload: DryRunLike, targetProfileId: string): FriendlySafetyCheck {
  const warnings = ((payload.warnings ?? []) as string[]).map(toFriendlyWarning);
  const rawWarnings = (payload.warnings ?? []) as string[];

  const hasCodexRunning = rawWarnings.some((w) => /codex appears to be running|codex process appears to be running/i.test(w));
  const setupRequired = rawWarnings.some((w) => /local switching is disabled|codexProfileRootPath is not configured|configured codexProfileRootPath does not exist|setup profile root/i.test(w));
  const targetMissing = rawWarnings.some((w) => /target profile has no captured snapshotPath|target snapshotPath does not exist/i.test(w));

  const backupReady = Boolean(payload.dryRun) && (payload.backupPlan?.length ?? 0) > 0;
  const restoreReady = Boolean(payload.dryRun) && (payload.restorePlan?.length ?? 0) > 0 && !targetMissing;

  const checks: FriendlySafetyCheck['checks'] = [
    {
      label: 'Current account backup',
      status: backupReady ? 'Ready' : payload.dryRun ? 'Unknown' : 'Failed',
      detail: backupReady ? 'Backup plan is prepared.' : 'Could not verify backup plan.',
    },
    {
      label: 'Target account saved login',
      status: targetMissing ? 'Failed' : restoreReady ? 'Ready' : payload.dryRun ? 'Warning' : 'Failed',
      detail: targetMissing ? 'Saved login is missing for this target account.' : restoreReady ? 'Saved login was found for the target account.' : 'Saved login could not be confirmed.',
    },
    {
      label: 'Codex status',
      status: hasCodexRunning ? 'Failed' : payload.dryRun ? 'Ready' : 'Unknown',
      detail: hasCodexRunning ? 'Codex appears to be open. Close it before switching.' : payload.dryRun ? 'Codex appears closed.' : 'Could not verify Codex process state.',
    },
    {
      label: 'Setup',
      status: setupRequired ? 'Warning' : 'Ready',
      detail: setupRequired ? 'Setup is required before switching.' : 'Setup appears complete.',
    },
    {
      label: 'Result',
      status: Boolean(payload.dryRun) && !hasCodexRunning && !setupRequired && !targetMissing ? 'Ready' : 'Failed',
      detail: Boolean(payload.dryRun) && !hasCodexRunning && !setupRequired && !targetMissing ? 'Safe to switch.' : 'Fix setup first.',
    },
  ];

  const canSwitch = checks[4].status === 'Ready';

  return {
    ok: Boolean(payload.dryRun),
    targetProfileId: payload.targetProfileId ?? targetProfileId,
    checks,
    canSwitch,
    warnings,
  };
}

export function buildFailedSafetyCheck(targetProfileId: string, error: unknown): FriendlySafetyCheck {
  const warning = toFriendlyWarning(String(error));
  return {
    ok: false,
    targetProfileId,
    checks: [
      { label: 'Current account backup', status: 'Unknown', detail: 'Could not run Safety Check.' },
      { label: 'Target account saved login', status: 'Unknown', detail: 'Could not run Safety Check.' },
      { label: 'Codex status', status: 'Unknown', detail: 'Could not run Safety Check.' },
      { label: 'Setup', status: 'Unknown', detail: 'Could not run Safety Check.' },
      { label: 'Result', status: 'Failed', detail: 'Fix setup first.' },
    ],
    canSwitch: false,
    warnings: [warning],
  };
}
