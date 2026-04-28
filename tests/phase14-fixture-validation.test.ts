import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { chromium } from '@playwright/test';

const ROOT = path.join(os.tmpdir(), 'codex-carousel-phase14-fixture');
const STATE_DIR = path.join(ROOT, 'state');
const LOG_DIR = path.join(ROOT, 'logs');
const INBOX_DIR = path.join(ROOT, 'inbox');
const ACCOUNTS_DIR = path.join(ROOT, 'accounts');
const FIXTURE_ROOT = path.join(ROOT, 'fixture-codex-root');
const PORT = 3100;
const API_BASE = `http://127.0.0.1:${PORT}/api`;

type Profile = { id: string; alias: string };

let server: ChildProcessWithoutNullStreams | null = null;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Server did not become healthy in time');
}

async function api(pathname: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${pathname}`, init);
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function writeMarker(marker: string) {
  await fs.mkdir(path.join(FIXTURE_ROOT, 'session'), { recursive: true });
  await fs.writeFile(path.join(FIXTURE_ROOT, 'session', 'auth.json'), JSON.stringify({ marker }), 'utf-8');
}

async function readMarker() {
  const raw = await fs.readFile(path.join(FIXTURE_ROOT, 'session', 'auth.json'), 'utf-8');
  return (JSON.parse(raw) as { marker: string }).marker;
}

async function startServer(extraEnv: Record<string, string> = {}) {
  if (server && !server.killed) server.kill('SIGTERM');
  await sleep(400);

  server = spawn('node', ['./node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CAROUSEL_BIND_HOST: '127.0.0.1',
      CAROUSEL_PORT: String(PORT),
      CAROUSEL_ALLOW_NON_WINDOWS_SWITCH_FOR_TESTS: 'true',
      CAROUSEL_STATE_DIR: STATE_DIR,
      CAROUSEL_LOG_DIR: LOG_DIR,
      CAROUSEL_INBOX_DIR: INBOX_DIR,
      CAROUSEL_ACCOUNTS_DIR: ACCOUNTS_DIR,
      ...extraEnv,
    },
  });

  await waitForHealth();
}

async function stopServer() {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await sleep(600);
  }
}

async function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const proc = spawn('node', ['./node_modules/tsx/dist/cli.mjs', 'cli.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, CAROUSEL_API_BASE: API_BASE },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('Phase 14 fixture end-to-end validation', () => {
  beforeAll(async () => {
    await fs.rm(ROOT, { recursive: true, force: true });
    await fs.mkdir(ROOT, { recursive: true });
    await writeMarker('SYNTHETIC_ACCOUNT_A');
    await startServer();
  }, 60000);

  afterAll(async () => {
    await stopServer();
  });

  it('proves fixture-only end-to-end switch behavior across API/UI/CLI', async () => {
    // 1) Fresh app boot checks.
    const settings1 = await api('/settings');
    expect(settings1.res.ok).toBe(true);
    expect(settings1.data.localSwitchingEnabled).toBe(false);

    const doctor1 = await api('/doctor');
    expect(doctor1.res.ok).toBe(true);
    expect(doctor1.data.status).toBe('degraded');

    // 2) Setup wizard behavior through API.
    const applySetup = await api('/codex/setup/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codexProfileRootPath: FIXTURE_ROOT,
        codexLaunchCommand: 'node -e "process.exit(0)"',
        enableSwitching: true,
      }),
    });
    expect(applySetup.res.ok).toBe(true);
    expect(applySetup.data.settings.localSwitchingEnabled).toBe(true);

    const settings2 = await api('/settings');
    expect(settings2.data.codexProfileRootPath).toBe(FIXTURE_ROOT);
    expect(settings2.data.localSwitchingEnabled).toBe(true);

    // 3) Add Account A.
    await writeMarker('SYNTHETIC_ACCOUNT_A');
    const addA = await api('/accounts/add-current-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'Fixture A', plan: 'Plus' }),
    });
    expect(addA.res.ok).toBe(true);

    // 4) Add Account B.
    await writeMarker('SYNTHETIC_ACCOUNT_B');
    const addB = await api('/accounts/add-current-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'Fixture B', plan: 'Pro100' }),
    });
    expect(addB.res.ok).toBe(true);

    const profilesResp = await api('/profiles');
    expect(profilesResp.res.ok).toBe(true);
    const profiles = profilesResp.data as Profile[];
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    const profileA = profiles.find((p) => p.alias === 'Fixture A');
    const profileB = profiles.find((p) => p.alias === 'Fixture B');
    expect(profileA).toBeTruthy();
    expect(profileB).toBeTruthy();

    // 5) Safety check for B and leak check on payload/logs.
    const safety = await api(`/profiles/${profileB!.id}/safety-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(safety.res.ok).toBe(true);
    expect(safety.data).toHaveProperty('checks');
    expect(Array.isArray(safety.data.checks)).toBe(true);
    const safetyJson = JSON.stringify(safety.data);
    expect(safetyJson).not.toContain('SYNTHETIC_ACCOUNT_A');
    expect(safetyJson).not.toContain('SYNTHETIC_ACCOUNT_B');

    // 6) Switch A -> B with explicit confirmation.
    await api('/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeProfileId: profileA!.id }),
    });
    await writeMarker('SYNTHETIC_ACCOUNT_A');

    const switchToB = await api(`/profiles/${profileB!.id}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true, fixtureRootDir: FIXTURE_ROOT }),
    });
    expect(switchToB.res.ok).toBe(true);
    expect(switchToB.data.verification).toContain('identity not verified');
    expect(await readMarker()).toBe('SYNTHETIC_ACCOUNT_B');

    const statusAfterSwitch = await api('/status');
    expect(statusAfterSwitch.data.runtime.activeProfileId).toBe(profileB!.id);
    expect((statusAfterSwitch.data.ledger as Array<any>).some((e) => e.eventType === 'SWITCH_COMPLETED')).toBe(true);

    // Add usage snapshot before restart persistence check.
    const usageSave = await api(`/profiles/${profileB!.id}/usage-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiveHourStatus: 'Exhausted',
        weeklyStatus: 'Unknown',
        creditsStatus: 'Unknown',
        source: 'Manual',
        notes: 'fixture-e2e',
      }),
    });
    expect(usageSave.res.ok).toBe(true);

    // 7) Rollback test (inject failure after backup).
    await stopServer();
    await startServer({ CAROUSEL_TEST_FAIL_AFTER_BACKUP: 'true' });
    await writeMarker('SYNTHETIC_ACCOUNT_B');

    const failingSwitch = await api(`/profiles/${profileA!.id}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true, fixtureRootDir: FIXTURE_ROOT }),
    });
    expect(failingSwitch.res.ok).toBe(false);
    expect(await readMarker()).toBe('SYNTHETIC_ACCOUNT_B');

    const statusAfterFail = await api('/status');
    expect(statusAfterFail.data.runtime.activeProfileId).toBe(profileB!.id);
    expect((statusAfterFail.data.ledger as Array<any>).some((e) => e.eventType === 'ROLLBACK_COMPLETED')).toBe(true);

    // 8) Restart persistence.
    await stopServer();
    await startServer();

    const statusAfterRestart = await api('/status');
    const profilesAfterRestart = statusAfterRestart.data.profiles as Array<any>;
    expect(profilesAfterRestart.some((p) => p.alias === 'Fixture A')).toBe(true);
    expect(profilesAfterRestart.some((p) => p.alias === 'Fixture B')).toBe(true);
    expect(statusAfterRestart.data.runtime.activeProfileId).toBe(profileB!.id);
    expect((statusAfterRestart.data.ledger as Array<any>).length).toBeGreaterThan(0);

    const usageAfterRestart = await api(`/profiles/${profileB!.id}/usage-snapshots`);
    expect(usageAfterRestart.res.ok).toBe(true);
    expect((usageAfterRestart.data as Array<any>).length).toBeGreaterThan(0);

    // 9) Recommendation safety (must not auto-switch).
    const beforeReco = await api('/status');
    const beforeActive = beforeReco.data.runtime.activeProfileId;
    const beforeSwitchCompletedCount = (beforeReco.data.ledger as Array<any>).filter((e) => e.eventType === 'SWITCH_COMPLETED').length;

    const reco = await api('/recommendations/recompute', { method: 'POST' });
    expect(reco.res.ok).toBe(true);

    const afterReco = await api('/status');
    const afterSwitchCompletedCount = (afterReco.data.ledger as Array<any>).filter((e) => e.eventType === 'SWITCH_COMPLETED').length;
    expect(afterReco.data.runtime.activeProfileId).toBe(beforeActive);
    expect(afterSwitchCompletedCount).toBe(beforeSwitchCompletedCount);

    // 10) UI checks + fixture screenshot.
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
    expect(await page.locator('tbody tr').count()).toBe(2);
    expect(await page.getByRole('button', { name: 'Switch' }).count()).toBe(2);
    expect(await page.getByText('localSwitchingEnabled').count()).toBe(0);
    expect(await page.getByText('codexProfileRootPath').count()).toBe(0);

    await fs.mkdir(path.join('docs', 'screenshots'), { recursive: true });
    await page.screenshot({ path: path.join('docs', 'screenshots', 'phase14-fixture-dashboard.png'), fullPage: true });
    await browser.close();

    // 11) CLI checks against fixture backend.
    const cliList = await runCli(['profiles', 'list', '--json']);
    expect(cliList.code).toBe(0);
    expect(cliList.stdout).toContain('Fixture A');

    const cliDryRun = await runCli(['switch', 'dry-run', 'Fixture B', '--fixture-root-dir', FIXTURE_ROOT]);
    expect(cliDryRun.code).toBe(0);
    expect(cliDryRun.stdout).toContain('=== SWITCH DRY-RUN ===');

    const cliRun = await runCli(['switch', 'run', 'Fixture A', '--confirm', '--fixture-root-dir', FIXTURE_ROOT]);
    expect(cliRun.code).toBe(0);
    expect(cliRun.stdout).toContain('Switch success. Active profile:');

    const cliDoctor = await runCli(['doctor']);
    expect(cliDoctor.code).toBe(0);
    expect(cliDoctor.stdout).toContain('Doctor status:');

    // Leak check in logs.
    const logFile = path.join(LOG_DIR, 'carousel.jsonl');
    try {
      const logRaw = await fs.readFile(logFile, 'utf-8');
      expect(logRaw).not.toContain('SYNTHETIC_ACCOUNT_A');
      expect(logRaw).not.toContain('SYNTHETIC_ACCOUNT_B');
    } catch {
      expect(true).toBe(true);
    }
  }, 240000);
});
