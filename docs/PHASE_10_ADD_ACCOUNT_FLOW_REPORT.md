# Phase 10 Add Account Flow Report

## Goal
Align Add Account with real user expectation:
- Open login
- User signs in
- Save that local Codex account
- Ready to switch later

## What changed
- Added friendly backend alias endpoint:
  - `POST /api/accounts/add-current-login`
  - Internally calls existing capture-current flow.
- Updated Add Account wizard UI to a clean 4-step flow:
  1. Setup check
  2. Open Codex Login
  3. Account details (Account Name, Plan, optional Notes)
  4. Save This Account
- Added success banner copy:
  - `Account Saved`
  - `Ready to Switch`
  - `Saved locally. Verify by opening Codex.`

## Error handling improvements
Added friendly translation for add-account specific backend failures:
- setup incomplete
- profile root missing
- Codex process currently running
- no local profile/login files found

No raw `Error:` strings are shown on main flow.

## UX language compliance
Main add flow now uses:
- Add Account
- Open Codex Login
- I Logged In
- Save This Account
- Account Name
- Plan
- Account Saved
- Ready to Switch

## Tests updated
- UI language checks include add-account steps and banned legacy wording.
- Endpoint wiring test includes friendly add-current-login alias route.
- Error translation tests include add-account specific mappings.

## Docs updated
- `README.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
