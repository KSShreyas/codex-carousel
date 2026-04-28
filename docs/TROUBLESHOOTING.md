# Troubleshooting

## Setup Required
If the app shows **Setup Required**, setup is incomplete.

What to do:
1. Click **Set Up Codex**.
2. Confirm data folder and Open Codex command.
3. Save setup.

## Codex data folder not found
If setup cannot find your data folder:
- run **Scan for Codex** again
- manually enter the folder path in setup
- save and retry

## Open Codex button does nothing
Usually the Open Codex command is missing or invalid.

Fix:
- open **Advanced Settings**
- update the Open Codex command
- save settings

## Switch blocked because Codex is open
You may see: **Codex appears to be open. Close it before switching.**

Fix:
1. Close Codex.
2. Run **Safety Check** again.
3. Switch only after Safety Check passes.

## Safety Check failed
If Safety Check says **Fix setup first**:
- confirm setup is complete
- make sure target account was saved correctly
- make sure Codex is closed
- run Safety Check again

## CLI npx blocked in PowerShell
Use fallback commands:

```powershell
npx.cmd tsx cli.ts switch run <profileId-or-alias> --confirm
node .\node_modules\tsx\dist\cli.mjs cli.ts switch run <profileId-or-alias> --confirm
```

## Identity verification unavailable
This means the switch completed, but automatic identity verification is not available in your environment.

This is expected in some environments and is reported honestly.

## No accounts saved
If you see no saved accounts:
1. Click **Add Account**
2. Complete login in Codex
3. Click **Save This Account**

## Usage unknown
If usage shows unknown values:
- click **Update Usage**
- enter current usage status manually
- save

## Backend not reachable
- Ensure `npm run dev` is running.
- Check `http://127.0.0.1:3000/api/health`.
