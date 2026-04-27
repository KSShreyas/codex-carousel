# CLI Reference

## Common commands

- `carousel status`
- `carousel profiles list`
- `carousel profiles create --alias <alias> --plan <plan>`
- `carousel usage update <profileId> --five-hour <status> --weekly <status> --credits <status>`
- `carousel recommend`
- `carousel ledger`
- `carousel doctor`
- `carousel launch`

## Switch commands

- `carousel switch dry-run <profileId>`
- `carousel switch status`
- `carousel switch clear-lock --confirm`
- `carousel switch run <profileId-or-alias> --confirm`

Compatibility path:
- `carousel switch <profileId-or-alias> --confirm`

The compatibility path is internally normalized to `switch run` to avoid Commander parsing conflicts.

## Windows invocation fallback

- `npx.cmd tsx cli.ts ...`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts ...`
