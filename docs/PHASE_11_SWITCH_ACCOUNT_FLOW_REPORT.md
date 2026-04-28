# Phase 11 Switch Account Flow Report

## Goal
Make account switching simple and safe for normal users:
- Click **Switch**
- Run and review **Safety Check**
- Confirm Codex is closed
- Switch explicitly

## What changed

### Backend
- Added friendly Safety Check endpoint:
  - `POST /api/profiles/:id/safety-check`
- Endpoint internally runs existing `dryRunSwitch` and returns simplified checks + warnings.
- Existing explicit switch endpoint is unchanged and still requires `confirm: true`.

### Frontend
- Saved-accounts primary action is now **Switch**.
- Switch modal runs Safety Check automatically on open.
- Safety output is rendered as friendly rows only:
  - Current account backup
  - Target account saved login
  - Codex status
  - Setup
  - Result
- Confirmation copy updated to:
  - `I understand Codex should be closed before switching.`
- Switch button remains disabled until:
  - Safety Check canSwitch is true
  - confirmation checkbox is checked

### Error handling / language
- Added friendly mapping for common switch failures.
- If Codex appears running, UI message is:
  - `Codex appears to be open. Close it before switching.`
- UI does not display raw dry-run JSON, fixture paths, lock internals, or raw backend stack strings.

## Tests updated
- Added adapter unit tests for friendly safety-check output.
- Updated UI language tests for Safety Check gating and confirmation copy.
- Updated endpoint wiring tests for `/api/profiles/:id/safety-check`.
- Updated error translation tests for switch-friendly messaging.

## Docs updated
- `README.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/PHASE_11_SWITCH_ACCOUNT_FLOW_REPORT.md`

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
