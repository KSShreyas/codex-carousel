# Final V1 Acceptance Report

Date: 2026-04-28

## 1) Final verdict
**Ready for personal use: Yes (with one explicit limitation).**

This acceptance pass is **ready for personal use** for fixture-validated/local workflow usage because:
- UI is polished and user-facing language is consistent.
- CLI explicit switch command works: `switch run <profile> --confirm`.
- Safe defaults are enforced until setup is completed.
- Screenshot workflow passed and screenshots were reviewed.
- Fixture E2E validation passes.
- Docs are aligned with current UX/safety behavior.

The only remaining limitation is still required local Windows real-account A/B validation.

## 2) Exact version and commit hash
- App version (`package.json`): `0.0.0`
- Commit hash at acceptance run: `0c140f1`

## 3) What works

### UX / product flow
- Main dashboard presents user-facing flows (Add Account, Switch, Open Codex, Advanced Settings).
- Raw backend field names are hidden from the main UI.
- Add Account and Save This Account flow is present and user-facing.
- Switch Account flow uses Safety Check and explicit user confirmation.
- Diagnostics are isolated in Advanced Settings.
- Empty and setup-required states are user-actionable.

### Safety model / switching behavior
- No automatic switching.
- No API-key workflow.
- No provider routing workflow.
- Local switching remains disabled by default until setup is valid.
- Real switch requires explicit confirmation.
- Backup-before-restore and rollback behavior are covered in fixture E2E validation.

### Backend + CLI
- Backend health/status endpoints and setup/discovery/switch surfaces are validated by tests.
- CLI commands validated in test suite and fixture E2E path:
  - `profiles list`
  - `switch dry-run`
  - `switch run <profile> --confirm`
  - `doctor`

### Engineering checks
- `typecheck`, `lint`, `test`, `build`, `screenshot`, and `e2e:ui` all pass in this environment.

## 4) What does not work
- **Not yet validated in this cloud pass:** real Windows machine account A/B switching against actual local Codex profiles and active Codex desktop process behavior.
- Identity-verification behavior can be environment-limited and must be validated/accepted on the target local machine.

## 5) Screenshots generated
- `docs/screenshots/main-dashboard.png`
- `docs/screenshots/add-account-modal.png`
- `docs/screenshots/switch-account-modal.png`
- `docs/screenshots/update-usage-modal.png`
- `docs/screenshots/advanced-settings.png`
- `docs/screenshots/phase14-fixture-dashboard.png`

## 6) Tests run
- `npm run typecheck` → pass
- `npm run lint` → pass
- `npm test` → pass (includes fixture validation test file)
- `npm run build` → pass
- `npm run screenshot` → pass
- `npm run e2e:ui` → pass

## 7) E2E fixture validation results
Fixture E2E coverage confirms:
- setup apply + safe defaults behavior,
- capture/add account against synthetic fixture,
- safety-check response shape,
- explicit confirmed switch,
- rollback on injected failure,
- restart persistence,
- CLI parity behavior.

Result: **PASS** (fixture-only scope).

## 8) Known limitations
1. Fixture/cloud tests do not replace real Windows local validation with real Codex accounts.
2. Identity verification may be unavailable in some environments.
3. Release should continue to describe this as personal-use-ready with local validation caveat, not universally production-validated.

## 9) Required local Windows real-account validation
Before claiming full local readiness on a specific machine, run the Windows validation checklist using real accounts:
- real data folder discovery/setup,
- Add Account for Account A/B,
- Safety Check + explicit switch both directions,
- rollback drill,
- restart persistence,
- no sensitive leak review in API/UI/CLI/logs.

Reference checklist:
- `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`

## 10) Final checklist table

| Area | Requirement | Status |
|---|---|---|
| UX | Main UI polished | PASS |
| UX | No raw backend internals on main screen | PASS |
| UX | Add/Save/Switch/Safety/Open flows clear | PASS |
| UX | Advanced settings + diagnostics hidden by default | PASS |
| UX | Current/saved accounts + empty state clear | PASS |
| UX | Screenshots generated and reviewed | PASS |
| Safety | No automatic switching | PASS |
| Safety | No fake usage / fake identity | PASS |
| Safety | No API-key/provider-routing flows | PASS |
| Safety | Safe defaults until setup | PASS |
| Safety | Real switch requires confirm | PASS |
| Safety | Backup + rollback validated in fixture E2E | PASS |
| Backend | Health/status/setup/discovery/capture/switch validated | PASS (fixture/cloud scope) |
| CLI | list/capture alias/dry-run/run --confirm/doctor/launch docs | PASS |
| Tests | typecheck/lint/test/build/screenshot/e2e | PASS |
| Docs | README/guide/troubleshooting/safety/checklist/completion report accuracy | PASS |
| Final limitation | Real Windows account A/B local validation still required | OPEN (expected) |

---

### Acceptance note
This repository passes the final V1 acceptance gate for **personal use** with the explicit and documented requirement that real Windows account-switch validation must still be performed locally with actual Codex accounts.
