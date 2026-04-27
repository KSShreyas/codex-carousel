import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('UI language scope reset', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('uses profile-switcher language in primary UI labels', () => {
    expect(app).toContain('Active Codex Profile');
    expect(app).toContain('Switch Profile');
    expect(app).toContain('Capture Current Login');
    expect(app).toContain('Observed Usage');
    expect(app).toContain('Reset / Next Safe Use');
    expect(app).toContain('5H Window Status');
    expect(app).toContain('Weekly/Plan Status');
    expect(app).toContain('Backend Status');
  });

  it('does not expose legacy force-rotate wording', () => {
    expect(app).not.toContain('Force Rotate');
  });
});
