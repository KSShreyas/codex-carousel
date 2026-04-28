import { chromium, type Page } from '@playwright/test';
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
    await sleep(300);
  }
  throw new Error('Backend did not become healthy in time.');
}

async function ensureProfilesForSwitchFlow() {
  const listRes = await fetch(`${API_BASE}/profiles`);
  if (!listRes.ok) throw new Error(`Failed listing profiles: HTTP ${listRes.status}`);
  const profiles = await listRes.json() as Array<{ id: string; alias: string }>;
  if (profiles.length > 0) return;

  const profilePayloads = [
    { alias: 'Visual QA Profile A', plan: 'Plus', priority: 1, snapshotPath: '/tmp/visual-profile-a.json' },
    { alias: 'Visual QA Profile B', plan: 'Pro100', priority: 1, snapshotPath: '/tmp/visual-profile-b.json' },
  ];

  for (const payload of profilePayloads) {
    const res = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Failed creating visual QA profile: ${msg}`);
    }
  }
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

async function clickRowAction(page: Page, actionName: string) {
  const actionButton = page.getByRole('button', { name: actionName }).first();
  await actionButton.click();
}

async function captureScreenshots() {
  const outputDir = path.join('docs', 'screenshots');
  await fs.mkdir(outputDir, { recursive: true });

  const backend = await startBackendIfNeeded();
  try {
    await ensureProfilesForSwitchFlow();

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByText('Codex Carousel V1.0').waitFor({ timeout: 15000 });

    await page.screenshot({ path: path.join(outputDir, 'main-dashboard.png'), fullPage: true });

    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByRole('heading', { name: 'Add Account' }).waitFor();
    await page.screenshot({ path: path.join(outputDir, 'add-account-modal.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cancel' }).first().click();

    await clickRowAction(page, 'Switch');
    await page.getByRole('heading', { name: 'Switch Account' }).waitFor();
    await sleep(700);
    await page.screenshot({ path: path.join(outputDir, 'switch-account-modal.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await page.getByRole('heading', { name: 'Switch Account' }).waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'networkidle' });

    await page.locator('button', { hasText: 'Update Usage' }).first().click({ force: true });
    await page.getByRole('heading', { name: 'Update Usage' }).waitFor();
    await page.screenshot({ path: path.join(outputDir, 'update-usage-modal.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cancel' }).first().click();

    await page.getByRole('button', { name: 'Advanced Settings' }).click();
    await page.getByRole('heading', { name: 'Advanced Settings' }).waitFor();
    await page.screenshot({ path: path.join(outputDir, 'advanced-settings.png'), fullPage: true });

    await browser.close();

    console.log('Saved UI screenshots to docs/screenshots/');
  } finally {
    if (backend.startedHere && backend.proc) {
      try {
        process.kill(-backend.proc.pid!, 'SIGTERM');
      } catch {}
    }
  }
}

captureScreenshots().catch((error) => {
  console.error('Screenshot generation failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
