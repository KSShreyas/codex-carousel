import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Phase 2 policy safety static checks', () => {
  it('server exposes profile APIs required for Phase 2', () => {
    const server = fs.readFileSync('server.ts', 'utf-8');
    expect(server).toContain('/api/profiles');
    expect(server).toContain('/api/recommendations');
    expect(server).toContain('/api/settings');
    expect(server).toContain('/api/ledger');
  });

  it('recommendations are not auto-switch actions', () => {
    const recommendationCode = fs.readFileSync('src/carousel/recommendations.ts', 'utf-8');
    expect(recommendationCode).not.toContain('setActiveProfile(');
  });

  it('CLI calls backend API endpoints for profiles/usage/recommend', () => {
    const cli = fs.readFileSync('cli.ts', 'utf-8');
    expect(cli).toContain("call('/profiles'");
    expect(cli).toContain('`/profiles/${profileId}/usage-snapshots`');
    expect(cli).toContain("call('/recommendations/recompute'");
  });

  it('normal mode does not fabricate usage values', () => {
    const monitor = fs.readFileSync('src/carousel/monitor.ts', 'utf-8');
    expect(monitor).toContain('if (!observed)');
    expect(monitor).toContain('return null');
  });
});
