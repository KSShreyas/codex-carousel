# Troubleshooting

## Backend not reachable
- Ensure `npm run dev` is running.
- Check `http://127.0.0.1:3000/api/health`.

## Switch button is disabled in UI
The real switch button stays disabled until all are true:
- dry-run succeeded
- explicit confirmation checked
- `localSwitchingEnabled=true`

## Local switching enabled warning shown
If local switching is enabled and `codexProfileRootPath` is empty, save a valid root path in settings.

## CLI real-switch command errors
Use either:
- `npx tsx cli.ts switch run <profileId-or-alias> --confirm`
- `npx tsx cli.ts switch <profileId-or-alias> --confirm`

Windows fallback:
- `npx.cmd tsx cli.ts ...`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts ...`

## Dry-run shows warnings
- Ensure profile snapshots exist.
- Ensure `codexProfileRootPath` is valid.
- Review doctor output and ledger events.

## Screenshot command fails
`npm run screenshot` requires Playwright and browser dependencies. The script reports exact missing dependency reasons and exits with error.
