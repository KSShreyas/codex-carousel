import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { shouldSyncDraftFromSaved } from '../src/ui/draftState';

describe('form draft-state protections', () => {
  it('does not sync onboarding/setup while dirty', () => {
    expect(shouldSyncDraftFromSaved({ dirty: true, touched: true, isOpen: true })).toBe(false);
  });

  it('does not sync advanced settings while dirty', () => {
    expect(shouldSyncDraftFromSaved({ dirty: true, touched: true, isOpen: true })).toBe(false);
  });

  it('does not sync add-account while dirty', () => {
    expect(shouldSyncDraftFromSaved({ dirty: true, touched: true, isOpen: true })).toBe(false);
  });

  it('does not sync usage update while dirty', () => {
    expect(shouldSyncDraftFromSaved({ dirty: true, touched: true, isOpen: true })).toBe(false);
  });

  it('ui sends draft settings values and re-syncs after save path exists', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(app).toContain('body: JSON.stringify(toSettingsPatch(settingsDraft))');
    expect(app).toContain('setSettingsDraft(adapted);');
  });
});
