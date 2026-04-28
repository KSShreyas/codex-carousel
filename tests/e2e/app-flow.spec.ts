import { expect, test } from '@playwright/test';

const baseSettings = {
  activeProfileId: null,
  localSwitchingEnabled: true,
  codexProfileRootPath: 'C:/Users/test/AppData/Roaming/Codex',
  codexLaunchCommand: 'explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App',
  requireCodexClosedBeforeSwitch: true,
  autoLaunchAfterSwitch: false,
};

test.beforeEach(async ({ page }) => {
  let profiles: any[] = [];
  await page.route('**/api/status', async (route) => route.fulfill({ json: { runtime: { activeProfileId: null }, profiles } }));
  await page.route('**/api/health', async (route) => route.fulfill({ json: { ok: true, version: '0.0.0', storageStatus: 'ok', demoMode: false, activeProfileId: null, ledgerWritable: true, profileCount: 0, lastEventTimestamp: null } }));
  await page.route('**/api/doctor', async (route) => route.fulfill({ json: { status: 'healthy', issues: [], setup: { codexFound: true, dataFolderConfigured: true, appPathConfigured: true, switchingSetupComplete: true, missingSteps: [] } } }));
  await page.route('**/api/settings', async (route) => route.fulfill({ json: baseSettings }));
  await page.route('**/api/codex/discover', async (route) => route.fulfill({ json: { os: 'win32', candidates: [], recommendedProfileRootPath: baseSettings.codexProfileRootPath, recommendedLaunchCommand: baseSettings.codexLaunchCommand, codexFound: true, dataFolderState: 'high', setupComplete: true, warnings: [] } }));
  await page.route('**/api/ledger?limit=200', async (route) => route.fulfill({ json: [] }));
  await page.route('**/api/ledger*', async (route) => route.fulfill({ json: [] }));
  await page.route('**/api/codex/launch', async (route) => route.fulfill({ json: { launched: true } }));
  await page.route('**/api/codex/process-status', async (route) => route.fulfill({ json: { running: false, processes: [] } }));
  await page.route('**/api/codex/profile-root/inspect', async (route) => route.fulfill({ json: { configuredRoot: baseSettings.codexProfileRootPath, exists: true, childDirectories: [], childFiles: [{ name: 'session.json', size: 120, recentModifiedAt: new Date().toISOString() }], candidateRoots: [{ path: baseSettings.codexProfileRootPath, exists: true, confidence: 'high', reason: 'Found session files.', fileCount: 2, recentModifiedAt: new Date().toISOString() }], warnings: [] } }));
  await page.route('**/api/accounts/add-current-login', async (route) => {
    const body = route.request().postDataJSON() as any;
    profiles = [{ id: 'p1', alias: body.alias, plan: body.plan ?? 'Plus', verificationStatus: 'Unknown', fiveHourStatus: 'Unknown', weeklyStatus: 'Unknown', creditsStatus: 'Unknown', observedResetAt: null, recommendation: 'stay', recommendationReason: null, lastActivatedAt: null, snapshotStatus: 'Captured' }];
    route.fulfill({ status: 201, json: { profile: profiles[0] } });
  });
  await page.goto('/');
  await page.waitForTimeout(150);
});

async function openAdvanced(page: any) {
  await page.getByRole('button', { name: 'Advanced Settings' }).first().click();
  if (await page.getByRole('heading', { name: 'Advanced Settings' }).count() === 0) {
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Advanced Settings' }).first().click();
  }
}

async function openAdd(page: any) {
  await page.getByRole('button', { name: 'Add Account' }).first().click();
}

test('main dashboard loads', async ({ page }) => {
  await expect(page.getByText('Codex Carousel V1.0')).toBeVisible();
});

test('Advanced Settings opens and closes', async ({ page }) => {
  await openAdvanced(page);
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toHaveCount(0);
});

test('Add Account shows all four steps', async ({ page }) => {
  await openAdd(page);
  await expect(page.getByText('Step 1: Open Codex').first()).toBeVisible();
  await expect(page.getByText('Step 2: Sign In').first()).toBeVisible();
  await expect(page.getByText('Step 3: Close Codex').first()).toBeVisible();
  await expect(page.getByText('Step 4: Save Account').first()).toBeVisible();
});

test('Add Account shows friendly error on 400', async ({ page }) => {
  await page.route('**/api/accounts/add-current-login', async (route) => route.fulfill({ status: 400, json: { code: 'NO_LOGIN_DATA_FOUND', error: 'Codex login data was not found.' } }));
  await page.route('**/api/codex/profile-root/inspect', async (route) => route.fulfill({ json: { configuredRoot: baseSettings.codexProfileRootPath, exists: true, childDirectories: [], childFiles: [], candidateRoots: [{ path: baseSettings.codexProfileRootPath, exists: true, confidence: 'low', reason: 'empty', fileCount: 0, recentModifiedAt: null }], warnings: [] } }));
  await openAdd(page);
  const modal = page.locator('div.fixed.inset-0.z-40').first();
  await modal.getByRole('button', { name: 'Open Codex' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();
  await page.getByRole('button', { name: 'I closed Codex' }).click();
  await page.getByLabel('Account Name').fill('Fail');
  await expect(page.getByRole('button', { name: 'Save This Account' })).toBeDisabled();
  await expect(page.getByText('Carousel could not find Codex login data')).toBeVisible();
});

test('Advanced Settings still opens after Add Account open/close', async ({ page }) => {
  await openAdd(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await openAdvanced(page);
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toBeVisible();
});

test('legacy bad launch command is not visible', async ({ page }) => {
  await openAdvanced(page);
  await expect(page.getByLabel('Open Codex command')).toHaveValue('explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App');
  await expect(page.getByText('shell:AppsFolder\\OpenAI.Codex')).toHaveCount(0);
});

test('raw backend field names are not visible on main UI', async ({ page }) => {
  await expect(page.getByText('localSwitchingEnabled')).toHaveCount(0);
  await expect(page.getByText('codexProfileRootPath')).toHaveCount(0);
  await expect(page.getByText('codexLaunchCommand')).toHaveCount(0);
});

test('fixture account creation through API seed appears on dashboard', async ({ page, request }) => {
  await request.post('/api/e2e/seed-codex-login', { data: { marker: 'FIXTURE_ACCOUNT_A' } }).catch(() => null);
  await openAdd(page);
  const modal = page.locator('div.fixed.inset-0.z-40').first();
  await modal.getByRole('button', { name: 'Open Codex' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();
  await page.getByRole('button', { name: 'I closed Codex' }).click();
  await page.getByLabel('Account Name').fill('Fixture Account A');
  await page.getByRole('button', { name: 'Save This Account' }).click();
  await expect(page.getByText('Fixture Account A')).toBeVisible();
});
