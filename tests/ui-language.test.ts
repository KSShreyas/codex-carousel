import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('UI dashboard regression protections', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('renders operator-console dashboard structure', () => {
    expect(app).toContain('Codex Carousel V1.0');
    expect(app).toContain('Active Profile Card');
    expect(app).toContain('Recommendation');
    expect(app).toContain('Usage Snapshot');
    expect(app).toContain('Settings');
    expect(app).toContain('Profile Table');
    expect(app).toContain('Event Ledger');
    expect(app).toContain('Doctor / Safety Status');
    expect(app).toContain('<table');
  });

  it('renders required actionable buttons', () => {
    expect(app).toContain('Capture Current Login');
    expect(app).toContain('Dry Run');
    expect(app).toContain('Switch Profile');
    expect(app).toContain('Launch Codex');
    expect(app).toContain('Save Settings');
    expect(app).toContain('Save Usage Snapshot');
  });

  it('keeps switch flow safety gating in UI logic', () => {
    expect(app).toContain('const dryRunPassed = Boolean(switchDryRun?.dryRun);');
    expect(app).toContain('const canRunRealSwitch = Boolean(switchTarget && dryRunPassed && switchConfirm && settings?.localSwitchingEnabled);');
    expect(app).toContain('disabled={!canRunRealSwitch}');
    expect(app).toContain('Confirm real switch');
    expect(app).toContain('Local switching disabled in settings.');
  });

  it('shows unknown states and doctor warnings intentionally', () => {
    expect(app).toContain('Unknown');
    expect(app).toContain('No doctor warnings detected.');
    expect(app).toContain('doctor.issues.map');
    expect(app).not.toContain('mock usage');
    expect(app).not.toContain('fake usage');
  });

  it('visual validation asset exists (script or checklist)', () => {
    expect(fs.existsSync('docs/UI_ACCEPTANCE_CHECKLIST.md') || fs.existsSync('scripts/screenshot.mjs')).toBe(true);
  });
});
