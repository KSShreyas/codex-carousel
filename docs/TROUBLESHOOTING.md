# Troubleshooting

## Backend not reachable
- Ensure `npm run dev` is running.
- Check `http://127.0.0.1:3000/api/health`.

## Setup Required banner is shown
Use **Set Up Codex** and complete all steps:
1. Scan for Codex
2. Set Codex data folder
3. Set Codex app path/launch command
4. Save setup with switching enabled

## "Setup required" errors while adding/switching
This means setup is incomplete (usually missing data folder or switching not enabled).
Open **Set Up Codex** and complete setup.

## Save This Account fails after login
- Make sure you clicked **Open Codex Login**, completed sign-in, then clicked **I Logged In**.
- If Codex is still running and save fails, close Codex and try **Save This Account** again.
- If the app says login data was not found, open Codex, complete login once more, and retry.

## Open Codex fails
If launch path/command is missing or invalid:
- open **Set Up Codex** or **Advanced Settings**
- update **Codex app path or launch command**
- save setup

## Switch button is disabled
The switch button stays disabled until:
- Safety Check has run and passed
- confirmation checkbox is checked
- target account exists

## CLI real-switch command errors
Use either:
- `npx tsx cli.ts switch run <profileId-or-alias> --confirm`
- `npx tsx cli.ts switch <profileId-or-alias> --confirm`

Windows fallback:
- `npx.cmd tsx cli.ts ...`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts ...`

## Screenshot command fails
`npm run screenshot` requires Playwright and browser dependencies. The script reports missing dependencies and exits with error.
