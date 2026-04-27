import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('UI Phase 2 fields', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('shows required active profile fields', () => {
    expect(app).toContain('Active Codex Profile');
    expect(app).toContain('Plan');
    expect(app).toContain('Verification Status');
    expect(app).toContain('5H Window Status');
    expect(app).toContain('Weekly/Plan Status');
    expect(app).toContain('Credits Status');
    expect(app).toContain('Reset / Next Safe Use');
    expect(app).toContain('Last Usage Snapshot');
    expect(app).toContain('Recommendation');
    expect(app).toContain('Event Ledger');
  });

  it('contains manual usage snapshot form fields', () => {
    expect(app).toContain('Manual Usage Snapshot');
    expect(app).toContain('fiveHourStatus');
    expect(app).toContain('weeklyStatus');
    expect(app).toContain('creditsStatus');
    expect(app).toContain('observedResetAt');
    expect(app).toContain('lastLimitBanner');
    expect(app).toContain('notes');
    expect(app).toContain('source');
  });
});
