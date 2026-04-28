# Phase 12 CLI and Safe Defaults Report

Date: 2026-04-28

## Goal
Resolve local validation blockers:
1. Safe-by-default startup state for switching.
2. Stable, unambiguous CLI real-switch command.

## Fix 1: Safe default state

### Runtime hygiene
- Added ignore rules for runtime/generated artifacts:
  - `state/`
  - `logs/`
  - `profile-snapshots/`
  - `rollbacks/`
  - `temp-validation/`
  - `*.local.json`

### Startup guard
- Durable store now disables `localSwitchingEnabled` on boot when setup is incomplete:
  - `codexProfileRootPath` missing
  - or configured path does not exist
- Guard appends a warning ledger event and saves corrected state.
- This keeps doctor/setup reporting in a required/degraded state until setup is valid.

### Tests
- Added tests for:
  - default `localSwitchingEnabled=false`
  - startup guard disabling switching when path is invalid
  - `.gitignore` runtime-hygiene rules

## Fix 2: CLI switch command

### Official command
- Real switch command is now explicitly:
  - `carousel switch run <profileId-or-alias> --confirm`
- Removed compatibility normalization that rewrote `switch <profile>` to `switch run <profile>`.

### Kept commands
- `carousel switch dry-run <profileId-or-alias>`
- `carousel switch status`
- `carousel switch clear-lock --confirm`

### Additional behavior
- `switch run` supports aliases with spaces (for example: `"Shreyas Pro"`).
- `switch dry-run` now resolves profile id or alias before calling backend.

### Tests
- Added/updated CLI tests for:
  - help output includes `switch run`
  - `switch run` fails without `--confirm`
  - `switch run --confirm` hits backend switch endpoint
  - `dry-run` still works
  - `status` still works

## Docs updated
- `README.md`
- `docs/USER_GUIDE.md`
- `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`
- `docs/FINAL_V1_COMPLETION_REPORT.md`
- `docs/TROUBLESHOOTING.md`
- `docs/PHASE_12_CLI_AND_SAFE_DEFAULTS_REPORT.md`

## Validation commands
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Release honesty
V1 should not be declared complete until these fixes pass local validation on target host.
