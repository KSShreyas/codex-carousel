import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Phase 8 simplified UI regression protections', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('does not expose raw backend labels on main app source', () => {
    expect(app).not.toContain('localSwitchingEnabled');
    expect(app).not.toContain('>codexProfileRootPath<');
    expect(app).not.toContain('>codexLaunchCommand<');
    expect(app).not.toContain('Doctor Panel');
    expect(app).not.toContain('Dry Run');
    expect(app).not.toContain('Capture Current Login');
  });

  it('contains required friendly labels', () => {
    expect(app).toContain('Add Account');
    expect(app).toContain('Save This Account');
    expect(app).toContain('Switch Account');
    expect(app).toContain('Safety Check');
    expect(app).toContain('Open Codex');
    expect(app).toContain('Advanced Settings');
    expect(app).toContain('Diagnostics');
    expect(app).toContain('Setup Required');
    expect(app).toContain('Set Up Codex');
    expect(app).toContain('Open Codex Login');
    expect(app).toContain('I Logged In');
    expect(app).toContain('Account Name');
    expect(app).toContain('Account Saved');
    expect(app).toContain('Ready to Switch');
  });

  it('contains required modal and drawer components', () => {
    expect(app).toContain('Add Account');
    expect(app).toContain('Update Usage');
    expect(app).toContain('Switch Account');
    expect(app).toContain('Advanced Settings');
    expect(app).toContain('Set Up Codex');
    expect(app).toContain('Setup check');
    expect(app).toContain('Account details');
  });

  it('uses friendly add-account endpoint alias in UI flow', () => {
    expect(app).toContain('/api/accounts/add-current-login');
    expect(app).toContain('await load();');
  });

  it('requires safety check and confirmation before switching', () => {
    expect(app).toContain('const canSwitchAccount = Boolean(selectedAccount && safetyResult?.completed && safetyResult.pass && switchConfirm);');
    expect(app).toContain('disabled={!canSwitchAccount}');
    expect(app).toContain('I confirm I want to switch accounts.');
  });

  it('visual validation assets still exist', () => {
    expect(fs.existsSync('docs/UI_ACCEPTANCE_CHECKLIST.md')).toBe(true);
    expect(fs.existsSync('scripts/screenshot.mjs')).toBe(true);
  });
});
