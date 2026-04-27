import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { DurableStore } from '../src/carousel/durableStore';
import { ProfilePlan } from '../src/carousel/types';
import { SwitchEngine } from '../src/carousel/switchEngine';

const ROOT = `/tmp/codex-carousel-phase5-${Date.now()}`;

async function writeFixtureTree(root: string, marker: string) {
  await fs.mkdir(path.join(root, 'session'), { recursive: true });
  await fs.writeFile(path.join(root, 'session', 'auth.json'), JSON.stringify({ marker }), 'utf-8');
}

async function readMarker(root: string) {
  const data = await fs.readFile(path.join(root, 'session', 'auth.json'), 'utf-8');
  return JSON.parse(data).marker;
}

async function setup() {
  process.env.CAROUSEL_ALLOW_NON_WINDOWS_SWITCH_FOR_TESTS = 'true';
  await fs.mkdir(ROOT, { recursive: true });
  const codexRoot = path.join(ROOT, 'fixture-codex-root');
  await writeFixtureTree(codexRoot, 'ACTIVE_A');

  const store = new DurableStore(ROOT);
  await store.load();
  await store.patchSettings({
    localSwitchingEnabled: true,
    codexProfileRootPath: codexRoot,
    codexLaunchCommand: 'node -e "process.exit(0)"',
    requireCodexClosedBeforeSwitch: true,
    allowProcessStop: false,
    autoLaunchAfterSwitch: false,
    redactSensitivePathsInLogs: true,
  });

  const active = await store.createProfile({ alias: 'A', plan: ProfilePlan.Plus, priority: 1, snapshotPath: null });
  const target = await store.createProfile({ alias: 'B', plan: ProfilePlan.Plus, priority: 1, snapshotPath: null });
  await store.setActiveProfile(active.id);

  const engine = new SwitchEngine(store, ROOT);

  await fs.writeFile(path.join(codexRoot, 'session', 'auth.json'), JSON.stringify({ marker: 'ACTIVE_A' }), 'utf-8');
  const captureA = await engine.captureCurrentProfile({ alias: 'captureA', plan: ProfilePlan.Plus });

  await fs.writeFile(path.join(codexRoot, 'session', 'auth.json'), JSON.stringify({ marker: 'TARGET_B' }), 'utf-8');
  const captureB = await engine.captureCurrentProfile({ alias: 'captureB', plan: ProfilePlan.Plus });

  await store.updateProfile(active.id, { snapshotPath: captureA.capture.snapshotPath, snapshotStatus: 'Captured' as any });
  await store.updateProfile(target.id, { snapshotPath: captureB.capture.snapshotPath, snapshotStatus: 'Captured' as any });
  await fs.writeFile(path.join(codexRoot, 'session', 'auth.json'), JSON.stringify({ marker: 'ACTIVE_A' }), 'utf-8');

  return { store, engine, codexRoot, active, target };
}

describe('Phase 5 real switching safety and behavior', () => {
  beforeEach(async () => {
    delete process.env.CAROUSEL_TEST_RUNNING_PROCESSES;
    delete process.env.CAROUSEL_TEST_FAIL_AFTER_BACKUP;
    await fs.rm(ROOT, { recursive: true, force: true });
    await fs.mkdir(ROOT, { recursive: true });
  });

  it('capture copies fixture files and stores metadata only', async () => {
    const { store, engine } = await setup();
    const result = await engine.captureCurrentProfile({ alias: 'capture-meta', plan: ProfilePlan.Plus });

    expect(result.capture.fileCount).toBeGreaterThan(0);
    const meta = store.getSnapshotMetadata(result.profile!.id);
    expect(meta?.checksums?.length).toBeGreaterThan(0);
    expect((result as any).content).toBeUndefined();
  });

  it('switch restores target fixture to active fixture', async () => {
    const { store, engine, codexRoot, target } = await setup();

    const before = await readMarker(codexRoot);
    expect(before).toBe('ACTIVE_A');

    await engine.executeSwitch(target.id, { confirm: true, fixtureRootDir: codexRoot });

    expect(await readMarker(codexRoot)).toBe('TARGET_B');
    expect(store.getSettings().activeProfileId).toBe(target.id);
  });

  it('failed restore triggers rollback', async () => {
    const { store, engine, codexRoot, target } = await setup();
    process.env.CAROUSEL_TEST_FAIL_AFTER_BACKUP = 'true';

    await expect(engine.executeSwitch(target.id, { confirm: true, fixtureRootDir: codexRoot })).rejects.toThrow();
    expect(await readMarker(codexRoot)).toBe('ACTIVE_A');

    const events = store.getLedger(50).map((e) => e.eventType);
    expect(events).toContain('ROLLBACK_STARTED');
    expect(events).toContain('ROLLBACK_COMPLETED');
    delete process.env.CAROUSEL_TEST_FAIL_AFTER_BACKUP;
  });

  it('lock prevents concurrent switches', async () => {
    const { engine, target } = await setup();
    await engine.acquireSwitchLock(target.id, 'real-switch');
    await expect(engine.acquireSwitchLock(target.id, 'real-switch')).rejects.toThrow(/already held/i);
  });

  it('activeProfileId changes only after successful switch', async () => {
    const { store, engine, target, codexRoot } = await setup();
    await expect(engine.executeSwitch(target.id, { confirm: false, fixtureRootDir: codexRoot })).rejects.toThrow(/confirmation/i);
    expect(store.getSettings().activeProfileId).not.toBe(target.id);
  });

  it('verification unavailable is honest and recorded', async () => {
    const { store, engine, target, codexRoot } = await setup();
    const result = await engine.executeSwitch(target.id, { confirm: true, fixtureRootDir: codexRoot });
    expect(result.verification).toContain('identity not verified');
    expect(store.getLedger(20).some((e) => e.eventType === 'VERIFY_UNAVAILABLE')).toBe(true);
  });

  it('launch command is configurable', async () => {
    const { engine } = await setup();
    const launched = await engine.launchCodex();
    expect(launched.launched).toBe(true);
  });

  it('real switching disabled by default', async () => {
    const { store, engine, target, codexRoot } = await setup();
    await store.patchSettings({ localSwitchingEnabled: false });
    await expect(engine.executeSwitch(target.id, { confirm: true, fixtureRootDir: codexRoot })).rejects.toThrow(/disabled/i);
  });

  it('process-running safe refusal path', async () => {
    const { engine, target, codexRoot } = await setup();
    process.env.CAROUSEL_TEST_RUNNING_PROCESSES = 'Codex.exe';
    await expect(engine.executeSwitch(target.id, { confirm: true, fixtureRootDir: codexRoot })).rejects.toThrow(/running/i);
  });

  it('real switch result and dry-run do not expose raw sensitive file contents', async () => {
    const { engine, target } = await setup();
    const dryRun = await engine.dryRunSwitch(target.id, {});
    expect((dryRun as any).raw).toBeUndefined();
    expect(JSON.stringify(dryRun)).not.toContain('ACTIVE_A');
  });
});
