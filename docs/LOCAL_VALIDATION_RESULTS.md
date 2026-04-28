# Local Validation Results

Date: 2026-04-27

## Summary
Phase 6 validation identified two blockers:
1. CLI real-switch command parsing.
2. Safe-by-default shipped state (`localSwitchingEnabled` persisted as true).

Phase 7 implements code + test fixes for both blockers. Real profile switching with real local Codex paths still must be validated on the target host before claiming full readiness.

## Required local re-validation
- Validate `switch run <profile> --confirm` on the real machine.
- Validate switch behavior with real `codexProfileRootPath` and Codex process state.
- Validate no sensitive leaks in API/UI/CLI/logs during real switch operations.
- Validate restart persistence for profiles/settings/ledger.

See:
- `docs/PHASE_7_UI_AND_BLOCKER_FIX_REPORT.md`
- `docs/UI_ACCEPTANCE_CHECKLIST.md`
