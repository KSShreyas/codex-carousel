# Phase 7 UI and Blocker Fix Report

Date: 2026-04-27

## Screenshot path
- `docs/current-ui.png` (generated when `npm run screenshot` succeeds).

## Before/after UI summary
- Before: raw checklist/form dump with weak visual hierarchy and limited switch flow clarity.
- After: restored operator-console dashboard with dark cyberpunk styling, clear cards, status badges, profile table, switch/capture controls, usage snapshot form, event ledger, and doctor/safety footer.

## CLI fix summary
- Fixed switch command parsing by introducing explicit `switch run <profile> --confirm` command.
- Added compatibility shim so documented `switch <profile> --confirm` is normalized to `switch run <profile> --confirm`.
- Added integration test coverage for both command shapes.

## Safe-by-default state fix summary
- Added `state/` and `logs/` to `.gitignore`.
- Removed committed `state/` files from the repository.
- Added startup guard in `DurableStore.load()` that forces `localSwitchingEnabled=false` for seed-like empty persisted states.
- Added regression test for seed-like persisted state boot behavior.

## Tests added
- UI regression tests for dashboard structure, action buttons, switch safety gating, doctor warnings, and visual validation artifact presence.
- CLI integration tests for `switch run <profile> --confirm` and compatibility path `switch <profile> --confirm`.
- Durable-store regression test for safe-by-default boot from seed-like persisted state.

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run screenshot` (optional; if environment lacks Playwright/browser deps, command fails with explicit reason)

## Remaining blockers
- Real profile switching still requires local host validation against real Codex profile paths and process conditions.
- Screenshot command depends on Playwright + browser runtime dependencies.

## V1 readiness for personal use
- Ready for cautious personal use **after** local validation of real switching paths on the target machine.
- Identity verification can still be `VerifyUnavailable` depending on available safe checks.
