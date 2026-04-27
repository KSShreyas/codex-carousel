import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/carousel/config';

describe('Demo mode gate', () => {
  it('is disabled by default', () => {
    delete process.env.CAROUSEL_DEMO_MODE;
    const config = loadConfig();
    expect(config.demoMode).toBe(false);
  });

  it('requires explicit CAROUSEL_DEMO_MODE=true', () => {
    process.env.CAROUSEL_DEMO_MODE = 'true';
    const config = loadConfig();
    expect(config.demoMode).toBe(true);
    delete process.env.CAROUSEL_DEMO_MODE;
  });
});
