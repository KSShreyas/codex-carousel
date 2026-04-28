import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { DurableStore } from '../src/carousel/durableStore';
import { applyCodexSetup } from '../src/carousel/codexSetup';

const ROOT = `/tmp/codex-carousel-setup-${Date.now()}`;

describe('codex setup apply', () => {
  beforeEach(async () => {
    await fs.rm(ROOT, { recursive: true, force: true });
    await fs.mkdir(ROOT, { recursive: true });
  });

  it('refuses enabling switching when profile root is missing', async () => {
    const store = new DurableStore(ROOT);
    await store.load();

    await expect(applyCodexSetup(store, {
      codexProfileRootPath: path.join(ROOT, 'missing-root'),
      codexLaunchCommand: null,
      enableSwitching: true,
    })).rejects.toThrow(/profile root/i);
  });

  it('saves profile root and enables switching when root exists', async () => {
    const profileRoot = path.join(ROOT, 'CodexData');
    await fs.mkdir(profileRoot, { recursive: true });

    const store = new DurableStore(ROOT);
    await store.load();

    const result = await applyCodexSetup(store, {
      codexProfileRootPath: profileRoot,
      codexLaunchCommand: 'C:/Program Files/Codex/Codex.exe',
      enableSwitching: true,
    });

    expect(result.setupComplete).toBe(true);
    const settings = store.getSettings();
    expect(settings.localSwitchingEnabled).toBe(true);
    expect(settings.codexProfileRootPath).toBe(profileRoot);
  });
});
