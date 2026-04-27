# Phase 3 CLI/API/UI Parity Report

Date: 2026-04-27

## Old truth path

Before this phase:

- Backend held durable data, but parity gaps remained:
  - CLI output was mostly raw JSON and had non-standard flag names.
  - No `/api/health` endpoint for local backend/storage sanity.
  - `/api/doctor` checks were too narrow.
  - Server bound to `0.0.0.0` by default.
  - UI did not show explicit backend/storage/doctor status warnings.

## New truth path

- Single source of truth remains **backend durable store**.
- CLI is HTTP-only and writes state only through backend APIs.
- UI loads status/health/doctor from backend endpoints only.
- No separate CLI in-memory registry or alternate storage files.

## CLI behavior

- Uses `http://127.0.0.1:3000/api` only.
- Commands now support human-readable output with optional `--json`.
- Required commands verified:
  - `carousel status`
  - `carousel profiles list`
  - `carousel profiles create --alias "..." --plan Plus`
  - `carousel usage update <profileId> --five-hour Available --weekly Unknown --credits Unknown --notes "manual"`
  - `carousel recommend`
  - `carousel ledger`
  - `carousel doctor`

## API behavior

- Backend now binds to localhost by default (`127.0.0.1`) unless explicitly overridden.
- Added `GET /api/health` with:
  - `ok`
  - `version`
  - `storageStatus`
  - `demoMode`
  - `activeProfileId`
  - `ledgerWritable`
  - `profileCount`
  - `lastEventTimestamp`
- Expanded `GET /api/doctor` checks:
  - storage exists
  - storage writable
  - ledger writable
  - demo mode consistency
  - no normal-mode demo profiles
  - active pointer validity
  - captured snapshot paths existence
  - no unfinished switch operation without recovery status

## UI behavior

- UI now displays backend connection and storage status.
- UI shows doctor warnings directly.
- UI continues to use backend API responses for profiles/ledger; no local profile truth simulation.

## Tests run

- `npm test`
- `npm run lint`

## Remaining risks

- Switch locking is ledger-derived; no dedicated lock file/mechanism yet.
- Snapshot path checks rely on local filesystem visibility from running backend process.
- Real Codex file switching and recovery orchestration remain out-of-scope for this phase.
