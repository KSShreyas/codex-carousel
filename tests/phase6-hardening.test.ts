import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DurableStore } from '../src/carousel/durableStore';
import { logger } from '../src/carousel/logging';

describe('Phase 6 hardening checks', () => {
  it('recommendation language uses safe approved text and avoids unsafe claims', () => {
    const code = fs.readFileSync('src/carousel/recommendations.ts', 'utf-8');
    expect(code).toContain('Stay on this profile');
    expect(code).toContain('Usage status low, consider choosing another available profile before starting a large task');
    expect(code).toContain('Current profile appears unavailable based on your manual snapshot');
    expect(code).toContain('Verify this profile before using it');
    expect(code).toContain('No recommendation because usage status is unknown');

    expect(code).not.toMatch(/Bypass limit/i);
    expect(code).not.toMatch(/Evade restriction/i);
    expect(code).not.toMatch(/Auto rotate/i);
    expect(code).not.toMatch(/Unlimited usage/i);
    expect(code).not.toMatch(/Keep working despite limits/i);
  });

  it('backend endpoint does not expose auto-switch execution path', () => {
    const server = fs.readFileSync('server.ts', 'utf-8');
    expect(server).not.toContain('/api/rotate');
    expect(server).not.toMatch(/setInterval\(.*performSwitch/s);
  });

  it('durable settings keep local switching disabled by default', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'carousel-p6-'));
    const store = new DurableStore(root);
    await store.load();
    expect(store.getSettings().localSwitchingEnabled).toBe(false);
  });

  it('logger redacts secret-like values', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'carousel-log-'));
    logger.setLogFile(path.join(root, 'test.jsonl'));
    await logger.init();
    logger.log('test', { apiToken: 'abc', password: 'pw', nested: { secret: 'x' }, normal: 'ok' });
    const entries = await logger.loadRecentEvents(1);
    const last = entries[0] as any;
    expect(last.apiToken).toBe('[REDACTED]');
    expect(last.password).toBe('[REDACTED]');
    expect(last.nested.secret).toBe('[REDACTED]');
    expect(last.normal).toBe('ok');
  });
});
