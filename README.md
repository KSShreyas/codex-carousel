# Codex Carousel V1.0

Codex Carousel is a local-first operator console for managing multiple **legitimate ChatGPT-login Codex profiles** with explicit, manual switching.

## Core guarantees

- Durable backend store is the source of truth.
- Safety gates remain enforced: dry-run + explicit confirmation + local switching toggle.
- No auto-switching, no provider routing, no API-key flows.
- No fake usage values or fake identity verification.
- Raw auth/session contents are not exposed in API/UI/CLI logs.

## UI (Phase 7)

The dashboard is restored to a production-style operator console:
- dark cyberpunk layout
- active profile/recommendation/usage/settings cards
- profile table + capture/switch controls
- event ledger
- doctor/safety status footer

See `docs/UI_ACCEPTANCE_CHECKLIST.md`.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Backend/UI default: `http://127.0.0.1:3000`.

## CLI quick usage

```bash
npx tsx cli.ts status
npx tsx cli.ts doctor
npx tsx cli.ts switch dry-run <profileId>
npx tsx cli.ts switch run <profileId-or-alias> --confirm
```

Compatibility path (also supported):

```bash
npx tsx cli.ts switch <profileId-or-alias> --confirm
```

Windows fallback:

```powershell
npx.cmd tsx cli.ts switch <profileId-or-alias> --confirm
node .\node_modules\tsx\dist\cli.mjs cli.ts switch <profileId-or-alias> --confirm
```

## V1 completion honesty

V1 is **not complete** unless both are fixed and validated:
1. CLI real-switch command path works as documented.
2. Shipped/default startup state is safe-by-default (`localSwitchingEnabled=false`).

Phase 7 addresses both in code/tests, but real profile switching must still be validated locally on your own machine.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run screenshot
```

If `npm run screenshot` fails, it should fail with an explicit dependency reason (Playwright/browser deps).
