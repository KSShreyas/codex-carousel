# Codex Carousel V1.0

Codex Carousel is a local-first operator tool for managing multiple **legitimate ChatGPT-login Codex profiles** with explicit, manual switching.

## What this app is

- A backend-owned durable state system for profiles, usage snapshots, settings, and switch ledger.
- A UI + CLI that both operate on the same backend API truth.
- A safety-gated switching workflow with dry-run, explicit confirmation, lock handling, and rollback.

## What this app is not

- Not an automatic quota rotator.
- Not a limit bypass tool.
- Not an API-key manager.
- Not a multi-provider router.
- Not an identity-forging or fake verification tool.

## V1 scope

- Codex-only workflow.
- Manual profile capture and manual usage snapshots.
- Dry-run before real switch.
- Real switch disabled by default (`localSwitchingEnabled=false`).
- Verification is honest: `VerifyUnavailable` is used when automated verification is not safely available.

## Install

```bash
npm install
```

## Run backend

```bash
npm run dev
```

Backend default: `http://127.0.0.1:3000`.

## Run frontend

The Vite frontend is served by the same dev server at `http://127.0.0.1:3000`.

## CLI usage

```bash
npx tsx cli.ts status
npx tsx cli.ts profiles list
npx tsx cli.ts doctor
```

## Profile capture

```bash
npx tsx cli.ts profiles capture-current --alias "Profile A" --plan Plus
```

## Dry-run switch

```bash
npx tsx cli.ts switch dry-run <profileId>
```

## Real switch

Requires explicit confirmation and local switching enabled:

```bash
npx tsx cli.ts switch <profileId> --confirm
```

## Launch Codex

```bash
npx tsx cli.ts launch
```

## Usage snapshots

Use manual snapshot updates from CLI or UI.

```bash
npx tsx cli.ts usage update <profileId> --five-hour Available --weekly Unknown --credits Unknown --source Manual --notes "manual snapshot"
```

## Recommendations

Recommendation language is intentionally safe and limited:

- Stay on this profile
- Usage status low, consider choosing another available profile before starting a large task
- Current profile appears unavailable based on your manual snapshot
- Verify this profile before using it
- No recommendation because usage status is unknown

## Doctor

```bash
npx tsx cli.ts doctor
```

Doctor reports storage, lock, active pointer, snapshot path, and launch configuration issues.

## Safety model

See `docs/SAFETY_MODEL.md`.

## Local Windows validation

See `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`.

## Troubleshooting

See `docs/TROUBLESHOOTING.md`.

## Data storage location

Default local paths:

- `./state/durable-state.json`
- `./state/durable-state.backup.json`
- `./state/profile-snapshots/`
- `./state/rollbacks/`
- `./logs/carousel.jsonl`

## Sensitive data handling

- Raw auth/session file contents are never sent to frontend.
- Ledger stores metadata-only switch events.
- Logger redacts token/password/secret-like fields.

## Release checklist

See `docs/RELEASE_CHECKLIST.md`.
