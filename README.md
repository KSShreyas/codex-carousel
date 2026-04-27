# Codex Carousel V1.0

Codex Carousel is a local-first account switcher for managing multiple **legitimate ChatGPT-login Codex profiles** with explicit, manual switching.

## Core guarantees

- Durable backend store is the source of truth.
- Safety gates remain enforced: dry-run + explicit confirmation + local switching toggle.
- No auto-switching, no provider routing, no API-key flows.
- No fake usage values or fake identity verification.
- Raw auth/session contents are not exposed in API/UI/CLI logs.

## UI (Phase 9)

The dashboard is now a simplified product UI:
- friendly header with backend/setup status
- setup banner + **Set Up Codex** wizard
- current account + saved accounts + recommendation + recent activity
- add-account, safety-check, switch-account, and update-usage modals
- technical diagnostics/settings hidden in Advanced Settings
- add-account wizard flow: **Open Codex Login → I Logged In → Save This Account**

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

## Codex setup wizard

If setup is missing, use **Set Up Codex**:
1. Scan for Codex
2. Confirm Codex data folder
3. Confirm Codex app path/launch command
4. Save setup and enable switching

Carousel does **not** ask for passwords, does **not** scrape token contents, and only stores safe filesystem metadata for discovery.

## Add Account flow

The add-account experience is explicitly user-facing:
1. Click **Add Account**
2. Click **Open Codex Login**
3. Sign in with the target ChatGPT/OpenAI account
4. Click **I Logged In**
5. Set **Account Name** and **Plan**
6. Click **Save This Account**

On success the UI shows **Account Saved** and **Ready to Switch** messaging.
