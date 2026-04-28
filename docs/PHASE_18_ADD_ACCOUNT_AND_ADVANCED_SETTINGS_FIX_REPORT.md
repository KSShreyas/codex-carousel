# Phase 18 - Add Account and Advanced Settings Fix Report

## Root cause of Add Account failure
- The Add Account wizard sequence skipped an explicit **close Codex** validation step and encouraged users to click save too early.
- The frontend submitted `/api/accounts/add-current-login` directly and only surfaced generic 400 handling, which left users with unclear remediation.
- The backend alias endpoint returned stringified errors without a stable error code contract for UI mapping.

## Root cause of Advanced Settings button failure
- Modal state interactions were not strictly coordinated; opening one surface could leave conflicting UI states that made the drawer unreliable after Add Account interactions.
- Escape handling did not consistently close only the top-most active modal/drawer state.

## Files changed
- `src/App.tsx`
- `server.ts`
- `src/carousel/switchEngine.ts`
- `src/ui/errorTranslation.ts`
- `e2e/ui.visual.pw.ts`
- `scripts/capture-ui-screenshots.ts`
- `tests/add-account-error-ui.test.ts`
- `tests/error-translation.test.ts`
- `tests/ui-language.test.ts`
- `tests/codex-discovery-endpoints.test.ts`

## API changes
- Added `GET /api/codex/process-status` returning:
  - `running: boolean`
  - `processes: string[]`
- Updated `/api/accounts/add-current-login` and `/api/profiles/capture-current` to return structured error payloads:
  - `error: string`
  - `code: CODEX_RUNNING | SETUP_REQUIRED | DATA_FOLDER_MISSING | NO_LOGIN_DATA_FOUND | UNKNOWN`
- Added backend mapping for known add-account errors to friendly, sanitized messages.

## UI changes
- Reworked Add Account into explicit 4-step flow:
  1. Step 1: Open Codex
  2. Step 2: Sign in with ChatGPT/OpenAI
  3. Step 3: Close Codex completely
  4. Step 4: Save This Account
- Added required instructional copy about closing Codex before save.
- Added `Check Again` process validation and save blocking while Codex is detected running.
- Added friendly error mapping in modal for coded API responses.
- Updated success toast copy to: `Account saved. You can now switch to it.`
- Improved modal/drawer state coordination and Escape behavior so only the active modal closes.

## Screenshots generated
- Intended outputs:
  - `docs/screenshots/main-dashboard.png`
  - `docs/screenshots/add-account-open-codex-step.png`
  - `docs/screenshots/add-account-close-codex-required.png`
  - `docs/screenshots/add-account-details-step.png`
  - `docs/screenshots/advanced-settings-open.png`
- **Not generated in this environment** due missing runtime library dependency for headless Chromium (`libatk-1.0.so.0`).

## Tests added/updated
- Updated Playwright UI suite in `e2e/ui.visual.pw.ts` to cover:
  - Dashboard load
  - Advanced Settings open/close
  - Add Account open
  - Open Codex launch call
  - CODEX_RUNNING blocking + friendly message
  - successful capture flow + account visibility
  - failed add-current-login body shown as friendly text
  - raw backend fields hidden
  - launch command default and legacy command absence
- Updated unit/regression tests for new copy and endpoint wiring.

## Commands run
- `npm install`
- `npx playwright install chromium`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run screenshot`
- `npm run e2e:ui`

## Remaining blockers
- Playwright browser launch is blocked in this container by missing system libraries (not npm packages), specifically:
  - `libatk-1.0.so.0`
- Because of that:
  - full Playwright e2e did not execute
  - screenshot capture did not complete
  - visual QA cannot be marked complete in this environment

## Manual local validation instructions
1. Start app.
2. Confirm `/api/settings` has `explorer.exe shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App`.
3. Click Open Codex Login.
4. Login to account.
5. Close Codex completely.
6. Confirm Task Manager has no Codex process.
7. Click Check Again.
8. Click Save This Account.
9. Confirm account appears.

## Ready for personal use
- **No** (cloud environment visual/e2e execution blocker remains).
