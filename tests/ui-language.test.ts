import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('UI V1 final fields and labels', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('shows required dashboard sections', () => {
    expect(app).toContain('Codex Carousel V1.0');
    expect(app).toContain('Backend Status');
    expect(app).toContain('Active Profile Card');
    expect(app).toContain('Plan/Capacity Card');
    expect(app).toContain('5H Window Status');
    expect(app).toContain('Weekly/Plan Status');
    expect(app).toContain('Credits Status');
    expect(app).toContain('Recommendation');
    expect(app).toContain('Profile Table');
    expect(app).toContain('Capture Current Login');
    expect(app).toContain('Dry-run switch');
    expect(app).toContain('Switch profile');
    expect(app).toContain('Launch Codex');
    expect(app).toContain('Usage Snapshot Modal');
    expect(app).toContain('Settings Panel');
    expect(app).toContain('Doctor Panel');
    expect(app).toContain('Event Ledger');
  });

  it('contains required state labels', () => {
    expect(app).toContain('Unknown');
    expect(app).toContain('Observed');
    expect(app).toContain('Verified');
    expect(app).toContain('Unverified');
    expect(app).toContain('Failed');
    expect(app).toContain('Dry-run only');
    expect(app).toContain('Local switching disabled');
    expect(app).toContain('Switch requires confirmation');
  });
});
