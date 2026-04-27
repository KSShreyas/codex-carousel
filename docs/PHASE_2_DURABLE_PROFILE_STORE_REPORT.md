# Phase 2 Durable Profile Store Report

Date: 2026-04-27

## Storage choice

- Chosen: **atomic JSON durable store** (`src/carousel/durableStore.ts`).
- Rationale: low-invasiveness for current repo, no heavy migration to SQLite required in this phase.
- Durability features implemented:
  - temp file write
  - fsync (`FileHandle.sync`) before rename
  - atomic rename
  - backup copy (`durable-state.backup.json`)
  - schema version (`schemaVersion: 2`)
  - corruption recovery path (fallback to backup when primary is unreadable)

## Schema

Stored in `durable-state.json`:

- `schemaVersion`
- `profiles[]`
- `usageSnapshots[]`
- `switchEvents[]`
- `settings` (includes `activeProfileId`, `demoMode`)
- `profileSnapshotMetadata`

## Migration path

- Load validates primary file.
- If invalid/corrupt, tries backup file.
- If schema version mismatches, migration updates version and re-saves.

## API list

Implemented in `server.ts`:

- `GET /api/status`
- `GET /api/profiles`
- `POST /api/profiles`
- `PATCH /api/profiles/:id`
- `GET /api/profiles/:id`
- `POST /api/profiles/:id/usage-snapshots`
- `GET /api/profiles/:id/usage-snapshots`
- `GET /api/ledger`
- `GET /api/recommendations`
- `POST /api/recommendations/recompute`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/doctor`

Backward-compatible alias routes kept:

- `GET /api/accounts` -> profiles list
- `POST /api/accounts/import` -> profile create mapping

## CLI list

Updated `cli.ts` commands:

- `carousel status`
- `carousel profiles list`
- `carousel profiles create --alias ... --plan ... --priority ...`
- `carousel profiles update <id> ...`
- `carousel usage update <profileId> ...`
- `carousel ledger`
- `carousel recommend`
- `carousel doctor`

## UI changes

Updated `src/App.tsx` with backend-driven display:

- Active Codex Profile panel
- Plan
- Verification Status
- 5H Window Status
- Weekly/Plan Status
- Credits Status
- Reset / Next Safe Use
- Last Usage Snapshot
- Recommendation
- Event Ledger
- Manual usage snapshot form (profile, statuses, reset, banner, notes, source)

## Tests added/updated

- `tests/integration.test.ts`
  - profile persistence after restart
  - usage snapshot persistence after restart
  - ledger persistence after restart
  - unknown usage remains unknown
  - exhausted active profile gives `SwitchNow` recommendation only
- `tests/arbiter.test.ts` (repurposed for phase-2 policy/API static checks)
- `tests/ui-language.test.ts` updated for phase-2 UI fields
- `tests/switch-endpoint.test.ts` updated for explicit/manual-only switch behavior
- Existing tests retained for demo mode and scaffold cleanup checks

## Commands run

- `npm test`
- `npm run lint`

## Known limitations

- No real Codex auth/session file switching (intentionally deferred).
- No Windows adapter implementation yet.
- Recommendation recompute currently writes per-profile update sequentially (can optimize in Phase 3).

## Phase 3 tasks

- CLI/API/UI parity polishing and stronger input validation.
- Dedicated recommendation target ranking endpoint.
- Better event querying/filtering and pagination.
- Dry-run switch flow and safety confirmation UX.
