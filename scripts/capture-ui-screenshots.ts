import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const API_BASE = `${BASE_URL}/api`;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendHealthy() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isBackendHealthy()) return;
    await sleep(250);
  }
  throw new Error('Backend did not become healthy in time.');
}

async function startBackendIfNeeded() {
  if (await isBackendHealthy()) {
    return { proc: null as ChildProcess | null, startedHere: false };
  }

  const proc = spawn('npm', ['run', 'dev'], {
    shell: false,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  proc.unref();

  await waitForHealth();
  return { proc, startedHere: true };
}

async function captureScreenshots() {
  const outputDir = path.join('docs', 'screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  const backend = await startBackendIfNeeded();
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

    const settings = {
      activeProfileId: null,
      localSwitchingEnabled: true,
      codexProfileRootPath: 'C:/Users/test/AppData/Roaming/Codex',
      codexLaunchCommand: 'explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App',
      requireCodexClosedBeforeSwitch: true,
      autoLaunchAfterSwitch: false,
    };

    await page.route('**/api/status', async (route) => {
      await route.fulfill({ json: { runtime: { activeProfileId: null }, profiles: [] } });
    });
    await page.route('**/api/health', async (route) => route.fulfill({ json: { ok: true, version: '0.0.0', storageStatus: 'ok', demoMode: false, activeProfileId: null, ledgerWritable: true, profileCount: 0, lastEventTimestamp: null } }));
    await page.route('**/api/doctor', async (route) => route.fulfill({ json: { status: 'healthy', issues: [], setup: { codexFound: true, dataFolderConfigured: true, appPathConfigured: true, switchingSetupComplete: true, missingSteps: [] } } }));
    await page.route('**/api/settings', async (route) => route.fulfill({ json: settings }));
    await page.route('**/api/ledger?*', async (route) => route.fulfill({ json: [] }));
    await page.route('**/api/profiles', async (route) => route.fulfill({ json: [] }));
    await page.route('**/api/codex/launch', async (route) => route.fulfill({ json: { launched: true } }));
    let processRunning = false;
    await page.route('**/api/codex/process-status', async (route) => route.fulfill({ json: processRunning ? { running: true, processes: ['Codex.exe'] } : { running: false, processes: [] } }));

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByText('Codex Carousel V1.0').waitFor({ timeout: 15000 });

    await page.screenshot({ path: path.join(outputDir, 'main-dashboard.png'), fullPage: true });

    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.screenshot({ path: path.join(outputDir, 'add-account-open-codex-step.png'), fullPage: true });

    await page.getByRole('button', { name: 'Open Codex Login' }).click();
    await page.getByRole('button', { name: 'I Signed In' }).click();
    processRunning = true;
    await page.getByRole('button', { name: 'Check Again' }).click();
    await page.screenshot({ path: path.join(outputDir, 'add-account-close-codex-required.png'), fullPage: true });

    processRunning = false;
    await page.getByRole('button', { name: 'Check Again' }).click();
    await page.getByRole('button', { name: 'I closed Codex' }).click();
    await page.screenshot({ path: path.join(outputDir, 'add-account-details-step.png'), fullPage: true });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Advanced Settings' }).click();
    await page.screenshot({ path: path.join(outputDir, 'advanced-settings-open.png'), fullPage: true });

    await browser.close();
    console.log('Saved UI screenshots to docs/screenshots/.');
  } finally {
    if (backend.startedHere && backend.proc) {
      try {
        process.kill(-backend.proc.pid!, 'SIGTERM');
      } catch {
        // ignore
      }
    }
  }
}

captureScreenshots().catch((error) => {
  console.error('Screenshot generation failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
