# Phase 16 Report: Form Draft State and Launch Defaults

## Where input reset was happening
- Global polling (`load()` every 5s) refreshed settings and clobbered open forms in setup and advanced settings.
- Setup and advanced settings were both bound directly to backend-refreshed objects.
- Add Account and Update Usage had partial risk from reactive state updates while dialogs were open.

## What forms now use draft state
- Setup wizard now tracks saved state and editable draft state with touch tracking.
- Advanced Settings now uses `savedSettings` and `settingsDraft` with reset support.
- Add Account modal now tracks touch state and offers Reset Changes.
- Update Usage modal now tracks touch state and offers Reset Changes.
- Shared sync rule uses `shouldSyncDraftFromSaved()` so polling updates backend-saved state but does not overwrite dirty drafts.

## Launch command default behavior
- Added default command for Microsoft Store Codex AppID:
  `start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"`.
- Discovery recommends this default when AppID package is detected.
- `shell:AppsFolder\\...` input is normalized to `start "" "shell:AppsFolder\\..."`.
- Explicit `start "" "..."` input is preserved.
- Added `/api/codex/launch-test` for draft-only launch testing.

## Tests added
- `tests/form-draft-state.test.ts`
- `tests/launch-command.test.ts`
- Updated discovery and endpoint wiring tests.

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Remaining issues
- UI tests are still largely source-string based (not full interactive React behavior tests).
- Discovery confidence is heuristic and may still require manual user validation on some Windows layouts.
