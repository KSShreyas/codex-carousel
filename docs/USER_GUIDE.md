# User Guide (V1.0)

## 1) Start
1. `npm install`
2. `npm run dev`
3. Open `http://127.0.0.1:3000`

## 2) Use the operator console layout
- Header shows backend/storage/local-switching status.
- Left column: active profile, recommendation, usage snapshot, settings.
- Main column: profile table, switch/capture controls, event ledger.
- Footer: doctor warnings + safety status.

## 3) Capture profiles
Use **Capture Current Login** after signing into Codex with each account.

## 4) Add manual usage snapshots
Set:
- `fiveHourStatus`
- `weeklyStatus`
- `creditsStatus`
- `observedResetAt`
- `lastLimitBanner`
- `notes`
- `source`

Then click **Save Usage Snapshot**.

## 5) Switch flow (required order)
1. Select target profile.
2. Run **Dry Run**.
3. Review backup/restore counts and warnings.
4. Check explicit confirmation.
5. Run **Switch Profile** (only enabled if dry-run passed + confirmation checked + local switching enabled).

## 6) Settings
Set and save:
- `localSwitchingEnabled`
- `codexProfileRootPath`
- `codexLaunchCommand`
- `requireCodexClosedBeforeSwitch`
- `autoLaunchAfterSwitch`

Warning is shown if local switching is enabled but root path is missing.

## 7) Launch + verify
Use **Launch Codex** and perform manual identity verification.
`VerifyUnavailable` may appear when safe automated identity checks are not available.

## 8) Real-world validation requirement
Even after passing tests, real profile switching must be validated locally on the target machine.
