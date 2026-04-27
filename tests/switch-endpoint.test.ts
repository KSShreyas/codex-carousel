import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Switch behavior is explicit/manual only', () => {
  const server = fs.readFileSync('server.ts', 'utf-8');

  it('requires explicit targetProfileId for manual switch', () => {
    expect(server).toContain('targetProfileId is required and must exist');
  });

  it('switch endpoint is pointer-update only in phase 2', () => {
    expect(server).toContain('realFileSwitching: false');
  });

  it('no automatic switch execution path exists in monitor callback wiring', () => {
    expect(server).not.toContain('performSwitch(reason)');
  });
});
