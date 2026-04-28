# Phase 17 Report: Launch Command Normalization and Add Account 400 UX Fixes

## Summary
- Added centralized launch command normalization via `normalizeCodexLaunchCommand`.
- Standardized preferred command storage to:
  `explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App`.
- Applied normalization across discovery, setup apply, settings patching, and launch paths.
- Added startup migration for legacy invalid launch values with a non-sensitive migration ledger event.
- Improved Add Account modal handling for HTTP 400 responses by showing friendly, translated, in-modal errors.

## Backend changes
- New normalization logic handles:
  - AppID-only input
  - `shell:AppsFolder\\...`
  - `start "" "shell:AppsFolder\\..."` conversion to `explorer.exe ...`
  - legacy invalid `OpenAI.Codex` variants
  - preserving normal `.exe` path launch commands
- Durable store startup migration normalizes stale launch command values and logs `SETTINGS_MIGRATED` with message `Codex launch command normalized`.
- `/api/settings` patch path now explicitly normalizes `codexLaunchCommand`.

## Frontend changes
- Setup wizard and Advanced Settings now use the preferred placeholder:
  `explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App`
- Help text now references detected AppID and store-app launch behavior.
- Add Account modal now:
  - parses JSON error bodies from failed add-current-login capture requests,
  - strips `Error:` prefixes,
  - maps known backend 400 errors to user-friendly actions,
  - displays errors inline in the modal (no silent failure).

## Tests added/updated
- Launch command normalization coverage for AppID/shell/explorer/start/legacy values.
- DurableStore startup migration test for stale command normalization and migration event.
- Settings patch normalization coverage.
- Switch engine launch-path normalization wiring coverage.
- Add Account modal 400 error display and stale frontend-command guardrails.

## Validation commands
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
