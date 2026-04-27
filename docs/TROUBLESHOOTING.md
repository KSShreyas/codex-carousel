# Troubleshooting

## Backend not reachable
- Ensure `npm run dev` is running.
- Check `http://127.0.0.1:3000/api/health`.

## Switch fails with confirmation error
- Re-run with explicit confirmation (`--confirm` in CLI).

## Switch fails with disabled error
- Enable `localSwitchingEnabled` in settings.

## Switch fails with process-running warning
- Close Codex and retry.

## Dry-run shows path warnings
- Configure `codexProfileRootPath` and ensure profile snapshots exist.

## Doctor degraded
- Run `carousel doctor` and resolve listed issues one by one.

## Rollback occurred
- Inspect ledger for `ROLLBACK_*` events and revalidate profile root contents.
