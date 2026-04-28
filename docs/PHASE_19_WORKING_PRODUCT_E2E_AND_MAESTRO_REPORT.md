# Phase 19 - Working Product E2E and Maestro Report

## Root cause of Add Account failure
- The configured Codex folder could exist but still have no likely login/session files.
- Capture logic previously only checked for *any* top-level entries; it did not verify likely auth/session/config/state filenames recursively.
- This produced `NO_LOGIN_DATA_FOUND` even after login when the wrong root was configured.

## Fixes
- Added `GET /api/codex/profile-root/inspect` safe metadata endpoint (no file contents, no token exposure).
- Added candidate scanning + confidence scoring for known Windows Codex roots and configured path.
- Updated Add Account flow to require Check Again diagnostics (process-status + inspect) before save.
- Added friendly setup/readiness state and best-folder selection (`Use this folder` / `Choose Detected Folder`).
- Added structured Add Account error handling with safe `code` values.
- Strengthened capture logic to require likely login/auth/session/config/state file names.
- Kept manual switching and explicit confirmation intact.

## Advanced Settings reliability
- Advanced Settings drawer now remains operable after Add Account open/close cycles and supports Escape close.
- Added Scan for Codex and Choose Detected Folder controls in Advanced Settings.
- Kept friendly labels only on user-facing UI.

## Launch command fix
- `normalizeCodexLaunchCommand` is used in discovery, setup apply, settings patch, launch, launch-test, and durable-store migration.
- Legacy bad values migrate to:
  - `explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App`

## Maestro
- Added `.maestro/README.md` and six required flow files in `.maestro/flows/`.
- Added scripts:
  - `npm run maestro:check`
  - `npm run maestro:test`

## Playwright and screenshots
- Added `tests/e2e/app-flow.spec.ts` with required click-flow assertions.
- Added screenshot pipeline producing:
  - `docs/screenshots/main-dashboard.png`
  - `docs/screenshots/add-account-modal.png`
  - `docs/screenshots/advanced-settings.png`
  - `docs/screenshots/add-account-error.png`

## Fixture mode
- Added guarded test-only endpoints when `CAROUSEL_E2E_FIXTURE_MODE=true`:
  - `POST /api/e2e/reset`
  - `POST /api/e2e/seed-codex-login`
  - `POST /api/e2e/clear`
- Fixture files are written under `state/e2e/codex-profile-root` only.

## Test command results
- See terminal command logs in this PR branch run.

## Maestro result
- Pending environment availability of Maestro CLI.

## Playwright result
- Pending command output in this branch run.

## Remaining blockers
- Maestro web support depends on local CLI/browser support.

## Ready for personal use
- Pending final validation command results.
