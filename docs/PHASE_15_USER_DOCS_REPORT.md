# Phase 15 User Docs Report

Date: 2026-04-28

## Goal
Rewrite core docs for normal users (not backend developers), with clear setup/add/switch guidance and consistent user-facing language.

## Files updated
- `README.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/SAFETY_MODEL.md`
- `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`
- `docs/FINAL_V1_COMPLETION_REPORT.md`
- `docs/PHASE_15_USER_DOCS_REPORT.md`

## Major changes

### README rewrite
Rebuilt `README.md` into the requested 18-section user flow:
1. Codex Carousel V1.0
2. What it does
3. What it does not do
4. Quick start
5. First-time setup
6. Add your first Codex account
7. Add another account
8. Switch accounts
9. Open Codex
10. Track usage manually
11. Recommendations
12. Advanced Settings and Diagnostics
13. CLI commands
14. Safety model
15. Troubleshooting
16. Known limitations
17. Local Windows validation
18. Release checklist

### User Guide update
- Converted to step-by-step flow language.
- Added screenshot path references under `docs/screenshots/`.
- Kept wording aligned with UI labels (Add Account, Save This Account, Switch Account, Safety Check, Setup Required, Diagnostics).

### Troubleshooting update
Added the requested user topics:
- Setup Required
- Codex data folder not found
- Open Codex button does nothing
- Switch blocked because Codex is open
- Safety Check failed
- CLI npx blocked in PowerShell
- Identity verification unavailable
- No accounts saved
- Usage unknown

### Safety Model rewrite
Explained in user-friendly terms:
- manual switching only
- no automatic cycling
- no password storage
- no fake usage
- no fake identity verification
- raw profile files never sent to UI
- local switching disabled until setup

### Local Windows checklist update
- Simplified to match UI-driven flow.
- Updated CLI real switch command to:
  - `switch run <profile> --confirm`

### Final V1 completion report update
- Explicitly avoids claiming done.
- Lists remaining blockers clearly before V1 completion.

## Language policy applied
- Preferred user-facing terms used consistently:
  - Account
  - Add Account
  - Save This Account
  - Switch Account
  - Safety Check
  - Setup Required
  - Diagnostics
- Avoided backend field names in mainline user docs except where technical reference is appropriate.

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Remaining caution
This documentation update does not replace local real-Windows switching validation.
