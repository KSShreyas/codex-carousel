# Phase 13 Visual QA Report

Date: 2026-04-28

## Goal
Implement a reliable screenshot + visual QA workflow in Codex Cloud and verify the UI against `docs/UI_ACCEPTANCE_CHECKLIST.md`.

## Tooling added
- Added Playwright test tooling as dev dependency:
  - `@playwright/test`
- Added scripts:
  - `npm run screenshot`
  - `npm run e2e:ui`
- Added Playwright config:
  - `playwright.config.ts`

## Browser/system dependencies
Installed in environment:
- `npx playwright install --with-deps chromium`

## Screenshot capture workflow
Implemented script:
- `scripts/capture-ui-screenshots.ts`

Behavior:
- Detects backend health and starts backend if needed.
- Seeds temporary API profiles if no profiles exist (for switch/update modal capture).
- Captures required artifacts:
  - `docs/screenshots/main-dashboard.png`
  - `docs/screenshots/add-account-modal.png`
  - `docs/screenshots/switch-account-modal.png`
  - `docs/screenshots/update-usage-modal.png`
  - `docs/screenshots/advanced-settings.png`

Screenshot binaries are generated artifacts and are not committed.

Compatibility wrapper retained:
- `scripts/screenshot.mjs`

## Visual QA review
Manual review documented in:
- `docs/SCREENSHOT_REVIEW.md`

Review outcome:
- Main dashboard: PASS
- Add Account modal: PASS
- Switch modal: PASS
- Advanced Settings: PASS

## Issues found and fixed
1. Main dashboard Recent Activity initially displayed raw dry-run error text.
2. Fixed by mapping dry-run ledger event types to friendly activity copy in `src/App.tsx`.
3. Regenerated screenshots and re-reviewed.

## E2E UI tests added
Created Playwright E2E spec:
- `e2e/ui.visual.pw.ts`

Coverage:
- main screen loads
- Add Account modal opens
- Advanced Settings opens
- Switch modal opens when account exists
- main screen does not show raw backend field names
- setup required copy is friendly
- no giant raw debug panel terms on main screen

## Commands executed
- `npm install`
- `npx playwright install --with-deps chromium`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run screenshot`
- `npm run e2e:ui`

## Final checklist status
- Screenshot artifact generation: PASS
- Manual screenshot review: PASS
- UI visual E2E checks: PASS
- Remaining concern: real host/local account validation is still required; do not claim V1 complete from cloud visual QA alone.
