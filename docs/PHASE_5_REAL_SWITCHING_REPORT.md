# Phase 5 Real Switching Report

Date: 2026-04-27

## Implemented switching strategy

- Added explicit safety-gated real switching flow.
- Switch requires: local switching enabled, profile root configured, writable storage, available lock, target snapshot metadata, successful dry-run, explicit confirmation, and safe Codex process state.
- Real switch flow: lock -> preflight -> dry-run -> backup active root -> restore target snapshot -> verification unavailable marker -> update active profile -> release lock.
- On failure after backup: automatic rollback attempt with rollback ledger events.

## Exact files touched

- `src/carousel/switchEngine.ts`
- `src/carousel/durableStore.ts`
- `src/carousel/types.ts`
- `server.ts`
- `cli.ts`
- `src/App.tsx`
- `tests/phase5-switch-engine.test.ts`
- `tests/switch-endpoint.test.ts`
- `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`

## API changes

- `POST /api/profiles/capture-current`
- `POST /api/profiles/:id/switch` (real switch, confirm required)
- `POST /api/switch` backward-compatible real switch wrapper
- `POST /api/codex/launch`
- Existing dry-run/lock endpoints retained.

## CLI changes

- `carousel profiles capture-current --alias "..." --plan ...`
- `carousel switch dry-run <profile>`
- `carousel switch <profileId-or-alias> --confirm`
- `carousel launch`

## UI changes

- Local switching settings controls.
- Capture Current Login button.
- Dry Run button and real Switch Profile confirmation gate.
- Launch Codex button.
- Verification unavailable warning.
- Switch history/rollback event visibility via ledger.

## Tests added

- Capture copies fixture files and stores metadata only.
- Real switch restores target fixture into active root.
- Failed restore triggers rollback.
- Lock blocks concurrent switches.
- `activeProfileId` only changes after successful switch.
- Sensitive raw contents not exposed in dry-run output.
- Verification unavailable is explicitly recorded.
- Launch command is configurable.
- Real switching disabled by default.
- Real switch requires explicit confirmation.
- Process-running refusal path.

## What was verified in cloud

- Safety gates and switch orchestration logic via unit/integration-style fixture tests.
- Ledger event lifecycles for dry-run/switch/rollback.
- API/CLI/UI wiring and confirmation requirements.

## What must be verified locally on Windows

- Exact Codex profile root path and required session artifacts.
- Real file lock behavior while Codex is running.
- Manual identity verification after restore.
- Launch command correctness per local install.

## Remaining risks

- Identity verification is marked unavailable unless official safe command exists.
- Codex local storage layouts may vary by version.
- Process detection is best-effort and may miss non-standard process names.
