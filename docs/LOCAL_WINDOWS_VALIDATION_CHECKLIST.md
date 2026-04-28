# Local Windows Validation Checklist (Phase 5)

Date: 2026-04-27

## Prerequisites

- Windows host with Codex installed.
- Two separate ChatGPT logins that can be used safely for test switching.
- Codex Carousel backend running locally.
- `localSwitchingEnabled` set to true in settings.

## Locate Codex local profile files

1. Check `%APPDATA%\Codex\` and `%LOCALAPPDATA%\Codex\`.
2. Identify files/directories whose timestamps change after login/logout.
3. Confirm these are profile/session artifacts needed for a signed-in session.

## Configure `codexProfileRootPath`

1. Open UI settings or call API:
   - `PATCH /api/settings`
2. Set:
   - `localSwitchingEnabled: true`
   - `codexProfileRootPath: "C:\\path\\to\\codex\\profile-root"`
   - `codexLaunchCommand: "<your codex launch command>"`

## Create two test ChatGPT login profiles

1. Login to profile A in Codex normally.
2. Capture profile A snapshot.
3. Logout/login as profile B in Codex normally.
4. Capture profile B snapshot.

## Capture profile A

- API:
  - `POST /api/profiles/capture-current` with `{ "alias": "Profile A", "plan": "Plus" }`
- CLI:
  - `carousel profiles capture-current --alias "Profile A" --plan Plus`

## Capture profile B

- API:
  - `POST /api/profiles/capture-current` with `{ "alias": "Profile B", "plan": "Plus" }`
- CLI:
  - `carousel profiles capture-current --alias "Profile B" --plan Plus`

## Switch A -> B

1. Run dry-run first:
   - `carousel switch dry-run <profileBId-or-alias>`
2. Confirm Codex is closed if required.
3. Execute real switch:
   - `carousel switch run <profileBId-or-alias> --confirm`

## Manual verification in Codex

1. Launch Codex manually or via `carousel launch`.
2. Confirm visible signed-in identity is profile B.
3. If identity cannot be programmatically verified, ensure UI/ledger shows verification unavailable warning.

## Rollback

- If switch fails after backup, backend should trigger rollback automatically.
- Verify ledger has `ROLLBACK_STARTED` and `ROLLBACK_COMPLETED` or `ROLLBACK_FAILED`.

## Inspect ledger

- CLI: `carousel ledger`
- API: `GET /api/ledger`

## Logs must not contain

- Raw token/session file contents.
- Passwords.
- OAuth tokens or secrets.

## Known risks

- Exact Codex profile file mappings may differ by install/version.
- File locks while Codex is open can block restore.
- Verification may remain unavailable without official safe identity command.

## Exact commands

- `carousel profiles capture-current --alias "Profile A" --plan Plus`
- `carousel profiles capture-current --alias "Profile B" --plan Plus`
- `carousel switch dry-run <profileBId-or-alias>`
- `carousel switch run <profileBId-or-alias> --confirm`
- `carousel launch`
- `carousel doctor`
