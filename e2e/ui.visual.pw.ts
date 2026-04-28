import { expect, test, type APIRequestContext } from '@playwright/test';

async function ensureProfiles(request: APIRequestContext) {
  const list = await request.get('/api/profiles');
  expect(list.ok()).toBeTruthy();
  const profiles = await list.json() as Array<{ id: string }>;
  if (profiles.length > 0) return;

  await request.post('/api/profiles', {
    data: { alias: 'UI Test Profile A', plan: 'Plus', priority: 1, snapshotPath: '/tmp/ui-a.json' },
  });
  await request.post('/api/profiles', {
    data: { alias: 'UI Test Profile B', plan: 'Pro100', priority: 1, snapshotPath: '/tmp/ui-b.json' },
  });
}

test.beforeEach(async ({ request, page }) => {
  await ensureProfiles(request);
  await page.goto('/');
  await expect(page.getByText('Codex Carousel V1.0')).toBeVisible();
});

test('main screen loads and uses friendly setup language', async ({ page }) => {
  await expect(page.getByText('Setup Required', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Setup required. Connect Codex before saving accounts.')).toBeVisible();
});

test('Add Account modal opens', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Account' }).click();
  await expect(page.getByRole('heading', { name: 'Add Account' })).toBeVisible();
});

test('Advanced Settings opens', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Advanced Settings' })).toBeVisible();
});

test('Switch modal opens when account exists', async ({ page }) => {
  await page.locator('tbody tr').first().getByRole('button', { name: 'Switch' }).click();
  await expect(page.getByRole('heading', { name: 'Switch Account' })).toBeVisible();
});

test('main screen hides raw backend/debug internals', async ({ page }) => {
  await expect(page.getByText('localSwitchingEnabled')).toHaveCount(0);
  await expect(page.getByText('codexProfileRootPath')).toHaveCount(0);
  await expect(page.getByText('codexLaunchCommand')).toHaveCount(0);
  await expect(page.getByText('Doctor Panel')).toHaveCount(0);
  await expect(page.getByText('Dry Run')).toHaveCount(0);
});
