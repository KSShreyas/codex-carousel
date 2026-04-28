# Phase 14 E2E Fixture Validation Report

Date: 2026-04-28

## Scope statement
This phase validates **fixture behavior only** in cloud using synthetic fixture directories.
It does **not** validate real Windows/Codex auth/session switching.

## Test state path
- `/tmp/codex-carousel-phase14-fixture`

## Fixture profile paths
- Fixture Codex root: `/tmp/codex-carousel-phase14-fixture/fixture-codex-root`
- Synthetic marker file: `/tmp/codex-carousel-phase14-fixture/fixture-codex-root/session/auth.json`
- API state dir: `/tmp/codex-carousel-phase14-fixture/state`
- API log dir: `/tmp/codex-carousel-phase14-fixture/logs`

## E2E implementation
- Added comprehensive fixture E2E validation test:
  - `tests/phase14-fixture-validation.test.ts`
- Added server config env override support for isolated state/log/inbox/accounts dirs:
  - `src/carousel/config.ts`
- Added server port override support for parallel-safe E2E execution:
  - `server.ts` via `CAROUSEL_PORT`

## Pass/fail matrix

| Step | Check | Result |
|---|---|---|
| 1 | Fresh boot health + local switching disabled default + degraded setup | PASS |
| 2 | Setup apply with valid fixture folder + switching enabled/persisted | PASS |
| 3 | Add Account A via synthetic marker capture | PASS |
| 4 | Add Account B via synthetic marker capture | PASS |
| 5 | Safety Check friendly payload + no marker leakage in payload | PASS |
| 6 | Switch A→B with explicit confirmation + marker/active profile/ledger verify | PASS |
| 7 | Rollback path with injected failure + marker restored + rollback event | PASS |
| 8 | Restart persistence for profiles/usage/ledger/active profile | PASS |
| 9 | Recommendation recompute does not auto-switch | PASS |
| 10 | UI checks + fixture screenshot + no raw backend field names on main UI | PASS |
| 11 | CLI checks (`profiles list`, `switch dry-run`, `switch run --confirm`, `doctor`) | PASS |

## Screenshots
- `docs/screenshots/phase14-fixture-dashboard.png`
- Existing UI suite screenshots (Phase 13 workflow):
  - `docs/screenshots/main-dashboard.png`
  - `docs/screenshots/add-account-modal.png`
  - `docs/screenshots/switch-account-modal.png`
  - `docs/screenshots/update-usage-modal.png`
  - `docs/screenshots/advanced-settings.png`

Note: Screenshot binaries are generated at test/runtime and are intentionally not committed.

## Leak check result
- Safety-check response did not include synthetic marker values.
- Main UI checks confirmed no raw backend field labels on the primary surface.
- Optional logger file (`carousel.jsonl`) may not exist if no logger events are emitted; when present, marker leakage is checked.

## Restart result
- After backend restart, profiles persisted.
- Usage snapshot persisted.
- Ledger persisted.
- Active profile persisted.

## CLI result
- `carousel profiles list --json` passed.
- `carousel switch dry-run <alias> --fixture-root-dir <fixtureRoot>` passed.
- `carousel switch run <alias> --confirm --fixture-root-dir <fixtureRoot>` passed.
- `carousel doctor` passed.

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run e2e:ui`
- `npm run screenshot`

## Remaining issues / cautions
- This validates **synthetic fixture switching only**.
- Real Windows/Codex profile switching behavior still requires local-machine validation per existing scope docs.
