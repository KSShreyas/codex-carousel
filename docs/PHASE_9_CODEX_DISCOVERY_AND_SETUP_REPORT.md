# Phase 9: Codex Discovery and Setup Report

## Discovery strategy
- Added `src/carousel/codexDiscovery.ts` with safe metadata-only discovery.
- Discovery checks likely Windows locations:
  - `%LOCALAPPDATA%\Packages\OpenAI.Codex_*`
  - package subdirs (`LocalState`, `RoamingState`, `LocalCache`, `TempState`)
  - `%APPDATA%\Codex`
  - `%LOCALAPPDATA%\Codex`
  - currently configured setup path (if present)
- Discovery only inspects directory existence and entry counts.
- Discovery does **not** read raw auth/session file contents.

## APIs added
- `GET /api/codex/discover`
  - Returns candidates with safe metadata, recommendations, setup status, and warnings.
- `POST /api/codex/setup/apply`
  - Accepts `codexProfileRootPath`, `codexLaunchCommand`, `enableSwitching`.
  - Refuses enabling switching when profile root is missing/non-existent.
  - Saves setup into settings and appends a setup event.

## UI added
- Added **Set Up Codex** wizard modal in `src/App.tsx` with steps:
  1. Find Codex
  2. Confirm Data Folder
  3. Confirm Launch Command
  4. Finish Setup
- Added setup-required banner on main dashboard.
- Kept technical details in Advanced Settings / Diagnostics.

## Limitations
- Windows Store launch command discovery may be medium confidence when exact command cannot be guaranteed.
- Cloud/test environments cannot fully validate native Windows package behavior.
- Screenshot automation still requires Playwright installation.

## Windows local validation required
- Validate discovery against real `%LOCALAPPDATA%\Packages\OpenAI.Codex_*` paths.
- Validate setup apply with actual Codex data folder.
- Validate Open Codex launch with configured command/path.
- Validate account save + switch flow with real local Codex state.

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
