import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Manual profile switch endpoint semantics', () => {
  const server = fs.readFileSync('server.ts', 'utf-8');

  it('includes explicit /api/switch endpoint', () => {
    expect(server).toContain('app.post("/api/switch"');
  });

  it('legacy /api/rotate is disabled', () => {
    expect(server).toContain('Legacy endpoint removed. Use /api/switch');
  });

  it('monitor callback does not auto-execute switching', () => {
    expect(server).toContain('never auto-switch');
    expect(server).not.toContain('Auto-switch failed');
  });
});
