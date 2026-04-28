import { chromium } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const BASE_URL = 'http://127.0.0.1:3000';
const API_HEALTH = `${BASE_URL}/api/health`;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(API_HEALTH);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Backend did not become healthy in time');
}

async function run() {
  const outputDir = path.join('docs', 'screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  let startedProc: ReturnType<typeof spawn> | null = null;
  try {
    await waitForHealth();
  } catch {
    startedProc = spawn('npm', ['run', 'dev'], { stdio: 'ignore', detached: true });
    startedProc.unref();
    await waitForHealth();
  }

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

  await page.route('**/api/status', async (route) => route.fulfill({ json: { runtime: { activeProfileId: null }, profiles: [] } }));
  await page.route('**/api/health', async (route) => route.fulfill({ json: { ok: true, version: '0.0.0', storageStatus: 'ok', demoMode: false, activeProfileId: null, ledgerWritable: true, profileCount: 0, lastEventTimestamp: null } }));
  await page.route('**/api/doctor', async (route) => route.fulfill({ json: { status: 'healthy', issues: [], setup: { codexFound: true, dataFolderConfigured: true, appPathConfigured: true, switchingSetupComplete: true, missingSteps: [] } } }));
  await page.route('**/api/settings', async (route) => route.fulfill({ json: settings }));
  await page.route('**/api/ledger?*', async (route) => route.fulfill({ json: [] }));
  await page.route('**/api/codex/launch', async (route) => route.fulfill({ json: { launched: true } }));
  await page.route('**/api/codex/process-status', async (route) => route.fulfill({ json: { running: false, processes: [] } }));
  await page.route('**/api/codex/profile-root/inspect', async (route) => route.fulfill({ json: { configuredRoot: settings.codexProfileRootPath, exists: true, childDirectories: [], childFiles: [{ name: 'session.json', size: 100, recentModifiedAt: new Date().toISOString() }], candidateRoots: [{ path: settings.codexProfileRootPath, exists: true, confidence: 'high', reason: 'found', fileCount: 2, recentModifiedAt: new Date().toISOString() }], warnings: [] } }));
  await page.route('**/api/accounts/add-current-login', async (route) => route.fulfill({ status: 400, json: { code: 'NO_LOGIN_DATA_FOUND', error: 'Codex login data was not found' } }));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outputDir, 'main-dashboard.png'), fullPage: true });

  await page.getByRole('button', { name: 'Add Account' }).first().click();
  await page.screenshot({ path: path.join(outputDir, 'add-account-modal.png'), fullPage: true });

  const modal = page.locator('div.fixed.inset-0.z-40').first();
  await modal.getByRole('button', { name: 'Open Codex' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();
  await page.getByRole('button', { name: 'I closed Codex' }).click();
  await page.getByLabel('Account Name').fill('Error Example');
  await page.getByRole('button', { name: 'Save This Account' }).click();
  await page.screenshot({ path: path.join(outputDir, 'add-account-error.png'), fullPage: true });

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await page.screenshot({ path: path.join(outputDir, 'advanced-settings.png'), fullPage: true });

  await browser.close();
  if (startedProc?.pid) {
    try {
      process.kill(-startedProc.pid, 'SIGTERM');
    } catch {}
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
