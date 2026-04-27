# Local Validation Results

Date: 2026-04-28
Environment: Windows local host, repository `C:\GameDev\Software\codex-carousel`

## Scope

Validated against the real local Windows environment using:

- the live local backend on `http://127.0.0.1:3000`
- the real local Codex installation/process environment
- safe fixture profile snapshots stored under `temp-validation/fixture-codex-root`

I did **not** print or inspect raw real auth/session payloads. Fixture snapshots used synthetic marker values only.

## Commands Run

### Documentation and code inspection

- `Get-Content -Raw docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`
- `Get-Content -Raw docs/SAFETY_MODEL.md`
- `Get-Content -Raw docs/FINAL_V1_COMPLETION_REPORT.md`
- `Get-Content -Raw server.ts`
- `Get-Content -Raw cli.ts`
- `Get-Content -Raw src/carousel/config.ts`
- `Get-Content -Raw src/carousel/durableStore.ts`
- `Get-Content -Raw src/carousel/switchEngine.ts`
- `Get-Content -Raw src/carousel/logging.ts`
- `Get-Content -Raw src/carousel/recommendations.ts`
- `Get-Content -Raw src/App.tsx`
- `Get-Content -Raw tests/phase5-switch-engine.test.ts`
- `Get-Content -Raw tests/phase6-hardening.test.ts`
- `Get-Content -Raw tests/switch-endpoint.test.ts`

### Environment discovery

- `Get-Process | Where-Object { $_.ProcessName -match 'codex' } | Select-Object ProcessName,Id,Path`
- `Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory | Where-Object { $_.Name -match 'OpenAI\.Codex' }`
- `Get-ChildItem "$env:LOCALAPPDATA\Packages\OpenAI.Codex_2p2nqsd0c76g0" -Directory`

### Backend / frontend startup

- `Start-Process node .\node_modules\tsx\dist\cli.mjs server.ts ...`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/health`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/`

### CLI / API validation

- `node .\node_modules\tsx\dist\cli.mjs cli.ts status`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts doctor`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts profiles capture-current --alias MissingPathCheck --plan Plus`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts profiles capture-current --alias FixtureProfileB --plan Plus`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts --json profiles list`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch dry-run profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts launch`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts recommend`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts ledger`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch --help`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0 --confirm`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch --confirm profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0`

### Direct API probes

- `PATCH /api/settings` to set:
  - `localSwitchingEnabled`
  - `codexProfileRootPath`
  - `codexLaunchCommand`
  - `requireCodexClosedBeforeSwitch`
- `POST /api/profiles/capture-current`
- `POST /api/profiles/:id/switch/dry-run`
- `POST /api/profiles/:id/switch` with `confirm: false`
- `POST /api/profiles/:id/switch` with `confirm: true`
- `POST /api/profiles/:id/usage-snapshots`
- `POST /api/recommendations/recompute`
- `GET /api/status`
- `GET /api/settings`
- `GET /api/ledger`
- `GET /api/profiles/:id/usage-snapshots`

### Persistence / restart

- stop process owning port `3000`
- restart backend with `Start-Process node .\node_modules\tsx\dist\cli.mjs server.ts ...`
- re-run `GET /api/health`
- re-run `GET /api/status`
- re-run `GET /api/ledger`
- re-run `GET /api/profiles/:id/usage-snapshots`

### Leak checks

- searched API responses and logs for fixture markers:
  - `FIXTURE_ACTIVE_A`
  - `FIXTURE_TARGET_B`

## Checklist Results

| # | Item | Result | Notes |
|---|---|---|---|
| 1 | backend starts | PASS | Backend started and served `/api/health` successfully on `127.0.0.1:3000`. |
| 2 | frontend starts | PASS | `/` returned `200` and served the dev frontend shell through Vite middleware. |
| 3 | CLI connects to backend | PASS | `status`, `doctor`, `profiles capture-current`, `dry-run`, `launch`, `recommend`, and `ledger` all reached the backend successfully. |
| 4 | doctor runs | PASS | Doctor executed successfully; final state reported `healthy`. |
| 5 | local switching is disabled by default | FAIL | Fresh `DurableStore` default is `false`, but the real repo state file currently starts with `localSwitchingEnabled: true`, so the live local environment is not safe-by-default right now. |
| 6 | Codex profile root path can be configured | PASS | `PATCH /api/settings` persisted `codexProfileRootPath`, and it survived backend restart. |
| 7 | capture-current refuses safely if path is missing | PASS | With `codexProfileRootPath: null`, `POST /api/profiles/capture-current` returned `400` with `Error: codexProfileRootPath is not configured`. |
| 8 | dry-run switch works with fixture profile snapshots | PASS | Dry-run returned a valid plan against captured fixture snapshots and emitted only metadata/plan information. |
| 9 | real switch requires explicit confirmation | FAIL | Backend/API enforces explicit confirmation correctly, but the documented CLI real-switch command is broken and cannot currently execute the confirmed switch path. |
| 10 | raw auth/session file contents never appear in API, UI, CLI or logs | PASS | API responses, CLI output, server stdout, and `logs/carousel.jsonl` did not contain the synthetic session markers used in fixture auth files. |
| 11 | profile state survives restart | PASS | Active profile remained `profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0` after backend restart. |
| 12 | ledger survives restart | PASS | Ledger entries remained present after restart, including `SWITCH_COMPLETED` and `SWITCH_RECOMMENDED`. |
| 13 | usage snapshot survives restart | PASS | Usage snapshot `usage_b13e8539-80c6-4304-b8ae-72297af6795c` remained available after restart. |
| 14 | recommendation engine never auto-switches | PASS | Recompute changed recommendation state only; active profile did not change and no new switch event was triggered by recommendation itself. |
| 15 | launch command is configurable | PASS | `codexLaunchCommand` was updated through settings and `launch` executed using the configured command. |

## Safe Snippets

### Backend health

```json
{"ok":true,"version":"0.0.0","storageStatus":"ok","demoMode":false,"activeProfileId":"profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0","ledgerWritable":true,"profileCount":3}
```

### Missing path refusal

```json
{
  "status": 400,
  "error": "Error: codexProfileRootPath is not configured"
}
```

### Real switch refusal without confirmation

```json
{
  "status": 400,
  "error": "Error: Explicit confirmation is required for real switch"
}
```

### Doctor

```text
Doctor status: healthy
No issues detected.
```

### Leak search result

```json
{
  "ApiHasActiveMarker": false,
  "ApiHasTargetMarker": false,
  "LogHasActiveMarker": false,
  "LogHasTargetMarker": false,
  "ServerOutHasActiveMarker": false,
  "ServerOutHasTargetMarker": false
}
```

## Issues Found

### 1. Live repo state is not safe-by-default

`state/durable-state.json` currently boots with `localSwitchingEnabled: true`.

Impact:

- This conflicts with the V1 safety model and checklist wording.
- A new local run using the checked-in state is not actually “disabled by default”.

### 2. Real switch CLI command is broken

The documented command shape from the checklist/report:

- `carousel switch <profileId> --confirm`

did not work locally.

Observed behavior:

- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0 --confirm`
  - `error: unknown command 'profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0'`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch --confirm profile_a58f2f4c-504a-4575-9cfc-2335aa8a2db0`
  - `error: unknown option '--confirm'`

Impact:

- The backend safety rule exists, but the CLI pathway for the real switch is not usable as documented.

### 3. `npx` PowerShell invocation is blocked by local execution policy

Observed behavior:

- `npx.ps1` could not run because script execution is disabled in PowerShell on this host.

Impact:

- This does not block the product itself because `node .\node_modules\tsx\dist\cli.mjs ...` works.
- It does make the documented `npx tsx cli.ts ...` workflow unreliable on this machine.

## Recommended Fixes

1. Make the shipped durable state safe-by-default.
   - Ensure `state/durable-state.json` is not committed with `localSwitchingEnabled: true`.
   - Prefer shipping an empty/default state or resetting this flag on first launch for local dev.

2. Fix the CLI real-switch command wiring.
   - The catch-all `switch <profileOrAlias>` command under `commander` needs to parse as an executable subcommand, including `--confirm`.
   - Add an integration test that runs the exact documented command shape end to end.

3. Add a Windows-safe CLI invocation note.
   - Document `node .\node_modules\tsx\dist\cli.mjs cli.ts ...` or `npx.cmd tsx cli.ts ...` as a fallback when PowerShell blocks `npx.ps1`.

4. Add a regression test for the safe-by-default runtime state.
   - Validate not just `DurableStore.defaultState()`, but also that the app boots safely when using the repository’s checked-in state files.

## Exact Files To Inspect

- `server.ts`
- `cli.ts`
- `src/carousel/durableStore.ts`
- `src/carousel/switchEngine.ts`
- `src/carousel/logging.ts`
- `src/carousel/recommendations.ts`
- `src/App.tsx`
- `tests/phase5-switch-engine.test.ts`
- `tests/phase6-hardening.test.ts`
- `tests/switch-endpoint.test.ts`
- `state/durable-state.json`

## Ready For Personal Use?

No, not yet.

Reason:

- The current local repo state is not safe-by-default because `localSwitchingEnabled` is already enabled in persisted state.
- The CLI real-switch command is broken in the exact user-facing path that the docs advertise.

If you fix those two items first, the rest of the V1 validation looked solid:

- backend/frontend startup worked
- API safety gates behaved correctly
- fixture-based dry-run and real switch worked
- restart persistence worked
- recommendation logic did not auto-switch
- no raw fixture session contents leaked through API/CLI/logs
