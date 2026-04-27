# Phase 4 Dry-Run Switch Engine Report

Date: 2026-04-27

## Services added

- Added `SwitchEngine` service with rollback-safe dry-run planning and lock management.
- Added required operations:
  - `preflightSwitch`
  - `dryRunSwitch`
  - `acquireSwitchLock`
  - `releaseSwitchLock`
  - `validateTargetProfile`
  - `validateActiveProfile`
  - `planBackup`
  - `planRestore`
  - `planRollback`
  - `writeLedgerEvents`

## APIs added

- `POST /api/profiles/:id/switch/dry-run`
- `GET /api/switch/status`
- `POST /api/switch/lock/clear` (explicit confirm + safe/stale checks)
- `POST /api/profiles/:id/switch` placeholder returning `dryRunOnly`
- `POST /api/switch` now also refuses real switching in Phase 4

## CLI added

- `carousel switch dry-run <profileId>`
- `carousel switch status`
- `carousel switch clear-lock --confirm`
- `carousel switch run <profileId>` explicitly refuses in Phase 4

## UI added

- Added Switch Profile flow that opens a dry-run confirmation panel.
- Panel shows:
  - source active profile
  - target profile
  - planned backup files (metadata only)
  - planned restore files (metadata only)
  - verification status
  - warnings
  - dry-run result
- Real switch button is present but disabled until Phase 5.

## Tests added

- Dry-run does not mutate fixture files.
- Switch lock prevents concurrent dry-runs.
- Doctor reports stale lock.
- Dry-run writes ledger events.
- Real switch endpoint refuses in Phase 4.
- UI includes dry-run flow and disabled real switch UI.
- API responses do not include raw file contents.

## Exact local Windows validation still needed

- Confirm true Codex profile/auth/session file paths.
- Confirm required file set for valid restored login state.
- Confirm permissions and lock behavior when app is active.
- Confirm backup/restore/rollback on real Windows hosts.

## Phase 5 prerequisites

- Verified Windows path mapping from manual validation.
- Atomic backup/restore implementation with checksum manifest.
- Crash-safe rollback execution path.
- Expanded doctor remediation guidance and recovery commands.
- End-to-end guarded real switch flow behind explicit operator control.
