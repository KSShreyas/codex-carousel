import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { DurableStore } from '../src/carousel/durableStore';
import { DEFAULT_CODEX_LAUNCH_COMMAND } from '../src/carousel/launchCommand';

const ROOT = `/tmp/codex-carousel-launch-${Date.now()}`;

describe('launch command migration and wiring', () => {
  beforeEach(async () => {
    await fsp.rm(ROOT, { recursive: true, force: true });
    await fsp.mkdir(ROOT, { recursive: true });
  });

  it('migrates legacy bad launch command on startup and logs migration event', async () => {
    const statePath = path.join(ROOT, 'durable-state.json');
    const seeded = {
      schemaVersion: 2,
      profiles: [],
      usageSnapshots: [],
      switchEvents: [],
      settings: {
        schemaVersion: 2,
        activeProfileId: null,
        demoMode: false,
        localSwitchingEnabled: false,
        codexProfileRootPath: null,
        codexLaunchCommand: 'start shell:AppsFolder\\OpenAI.Codex',
        requireCodexClosedBeforeSwitch: true,
        allowProcessStop: false,
        autoLaunchAfterSwitch: false,
        redactSensitivePathsInLogs: true,
      },
      profileSnapshotMetadata: {},
    };
    await fsp.writeFile(statePath, JSON.stringify(seeded, null, 2), 'utf-8');

    const store = new DurableStore(ROOT);
    await store.load();

    expect(store.getSettings().codexLaunchCommand).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
    expect(store.getLedger(20).some((evt) => evt.eventType === 'SETTINGS_MIGRATED' && evt.message === 'Codex launch command normalized')).toBe(true);
  });

  it('patchSettings normalizes launch command', async () => {
    const store = new DurableStore(ROOT);
    await store.load();
    const updated = await store.patchSettings({ codexLaunchCommand: 'shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App' });
    expect(updated.codexLaunchCommand).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
  });

  it('server PATCH /api/settings path normalizes launch command payload', () => {
    const server = fs.readFileSync('server.ts', 'utf-8');
    expect(server).toContain('codexLaunchCommand: normalizeCodexLaunchCommand(req.body?.codexLaunchCommand)');
  });

  it('launchCodex uses normalized launch command', () => {
    const engine = fs.readFileSync('src/carousel/switchEngine.ts', 'utf-8');
    expect(engine).toContain('const command = normalizeCodexLaunchCommand(commandOverride ?? this.store.getSettings().codexLaunchCommand);');
  });
});
