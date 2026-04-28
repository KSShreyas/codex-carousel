import { expect, test } from '@playwright/test';

const baseSettings = {
  activeProfileId: null,
  localSwitchingEnabled: true,
  codexProfileRootPath: 'C:/Users/test/AppData/Roaming/Codex',
  codexLaunchCommand: 'explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App',
  requireCodexClosedBeforeSwitch: true,
  autoLaunchAfterSwitch: false,
};

async function mockDashboard(page: any) {
  await page.route('**/api/status', async (route) => {
    await route.fulfill({
      json: {
        runtime: { activeProfileId: null },
        profiles: [],
      },
    });
  });
  await page.route('**/api/health', async (route) => route.fulfill({ json: { ok: true, version: '0.0.0', storageStatus: 'ok', demoMode: false, activeProfileId: null, ledgerWritable: true, profileCount: 0, lastEventTimestamp: null } }));
  await page.route('**/api/doctor', async (route) => route.fulfill({ json: { status: 'healthy', issues: [], setup: { codexFound: true, dataFolderConfigured: true, appPathConfigured: true, switchingSetupComplete: true, missingSteps: [] } } }));
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ json: baseSettings });
      return;
    }
    await route.fulfill({ json: baseSettings });
  });
  await page.route('**/api/ledger?*', async (route) => route.fulfill({ json: [] }));
  await page.route('**/api/profiles', async (route) => route.fulfill({ json: [] }));
  await page.route('**/api/codex/launch', async (route) => route.fulfill({ json: { launched: true } }));
  await page.route('**/api/codex/process-status', async (route) => route.fulfill({ json: { running: false, processes: [] } }));
  await page.route('**/api/accounts/add-current-login', async (route) => route.fulfill({ status: 201, json: { profile: { id: 'p1', alias: 'Saved Account', plan: 'Plus' } } }));
}

test.beforeEach(async ({ page }) => {
  await mockDashboard(page);
  await page.goto('/');
  await expect(page.getByText('Codex Carousel V1.0')).toBeVisible();
});

test('main dashboard loads', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Add Account' })).toBeVisible();
});

test('Advanced Settings button opens and closes drawer', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toHaveCount(0);
});

test('Add Account opens and launch endpoint is called', async ({ page }) => {
  let launchCalls = 0;
  await page.route('**/api/codex/launch', async (route) => {
    launchCalls += 1;
    await route.fulfill({ json: { launched: true } });
  });

  await page.getByRole('button', { name: 'Add Account' }).click();
  await expect(page.getByRole('heading', { name: 'Add Account' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Codex Login' }).first().click();
  await expect.poll(() => launchCalls).toBe(1);
});

test('CODEX_RUNNING blocks save and shows friendly message', async ({ page }) => {
  await page.route('**/api/codex/process-status', async (route) => route.fulfill({ json: { running: true, processes: ['Codex.exe'] } }));
  await page.route('**/api/accounts/add-current-login', async (route) => route.fulfill({ status: 400, json: { code: 'CODEX_RUNNING', error: 'Codex is still open. Close Codex completely, then click Check Again.' } }));

  await page.getByRole('button', { name: 'Add Account' }).click();
  await page.getByRole('button', { name: 'Open Codex Login' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();

  await expect(page.getByText('Codex is still open. Close Codex completely, then click Check Again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I closed Codex' })).toBeDisabled();
});

test('capture success adds account and shows success toast', async ({ page }) => {
  let statusCall = 0;
  await page.route('**/api/status', async (route) => {
    statusCall += 1;
    const profiles = statusCall > 1 ? [{ id: 'p1', alias: 'Saved Account', plan: 'Plus', verificationStatus: 'Unknown', fiveHourStatus: 'Unknown', weeklyStatus: 'Unknown', creditsStatus: 'Unknown', observedResetAt: null, recommendation: 'stay', recommendationReason: null, lastActivatedAt: null, snapshotStatus: 'Captured' }] : [];
    await route.fulfill({ json: { runtime: { activeProfileId: null }, profiles } });
  });

  await page.getByRole('button', { name: 'Add Account' }).click();
  await page.getByRole('button', { name: 'Open Codex Login' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();
  await page.getByRole('button', { name: 'I closed Codex' }).click();
  await page.getByLabel('Account Name').fill('Saved Account');
  await page.getByRole('button', { name: 'Save This Account' }).click();

  await expect(page.getByText('Account saved. You can now switch to it.')).toBeVisible();
  await expect(page.getByText('Saved Account')).toBeVisible();
});

test('failed add-current-login body appears as friendly text', async ({ page }) => {
  await page.route('**/api/accounts/add-current-login', async (route) => route.fulfill({ status: 400, json: { code: 'NO_LOGIN_DATA_FOUND', error: 'Codex login data was not found. Open Codex, sign in, close Codex, then try again.' } }));

  await page.getByRole('button', { name: 'Add Account' }).click();
  await page.getByRole('button', { name: 'Open Codex Login' }).click();
  await page.getByRole('button', { name: 'I Signed In' }).click();
  await page.getByRole('button', { name: 'Check Again' }).click();
  await page.getByRole('button', { name: 'I closed Codex' }).click();
  await page.getByLabel('Account Name').fill('Failing Account');
  await page.getByRole('button', { name: 'Save This Account' }).click();

  await expect(page.getByText('Codex login data was not found. Open Codex, sign in, close Codex, then try again.')).toBeVisible();
});

test('main UI hides raw backend field names', async ({ page }) => {
  await expect(page.getByText('localSwitchingEnabled')).toHaveCount(0);
  await expect(page.getByText('codexProfileRootPath')).toHaveCount(0);
  await expect(page.getByText('codexLaunchCommand')).toHaveCount(0);
});

test('launch command default is correct and legacy value not shown', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.getByLabel('Open Codex command')).toHaveValue('explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App');
  await expect(page.getByText('shell:AppsFolder\\OpenAI.Codex', { exact: false })).toHaveCount(0);
});
