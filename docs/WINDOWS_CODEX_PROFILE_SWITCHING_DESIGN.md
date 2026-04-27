# Windows Codex Profile Switching Design (Phase 4)

Date: 2026-04-27  
Status: Phase 4 dry-run design; **real switching not implemented**.

## Scope and safety statement

This design covers rollback-safe profile switch orchestration for Windows hosts in a **dry-run first** posture. In this repository/cloud environment, exact Codex Desktop local auth/session file paths cannot be conclusively verified from source code alone. Therefore, Phase 4 does not perform dangerous local writes to real Codex profile/auth files.

## Believed local files/directories for Codex login/profile state

Potential Windows locations to validate locally (manual only):

- `%APPDATA%\Codex\` (roaming settings/session candidates)
- `%LOCALAPPDATA%\Codex\` (runtime/cache/session candidates)
- `%USERPROFILE%\.codex\` (CLI/state candidates)

These are hypotheses based on common app patterns and must be confirmed manually on target machines before Phase 5.

## Safe discovery approach

1. Enumerate only known candidate directories.
2. Do metadata-only inspection first (existence, mtime, size, permissions).
3. Avoid parsing or printing raw token/session data.
4. Require explicit operator opt-in for any future write mode.
5. Never run discovery outside fixture directories in automated tests.

## Cloud-validated vs local-validated

### What can be validated in cloud/backend now

- Profile registry integrity (target exists, active pointer validity).
- Dry-run switch plan generation.
- Lock file lifecycle and stale detection.
- Ledger event writing.

### What must be validated locally on Windows

- Actual Codex auth/session file location mapping.
- File lock behavior when Codex is running.
- ACL/permission behavior for backup/restore paths.
- End-to-end post-restore Codex login validity.

## Data handling restrictions

### Files/content that must never be uploaded to logs

- Raw auth/session files.
- OAuth/access/refresh tokens.
- Cookies, credential databases, keychain export files.

### Data that must never be sent to frontend

- Raw file contents from profile/auth/session data.
- Token-like values or credential fields.
- Full local filesystem dumps.

Frontend may receive metadata only: file paths, existence flags, plan actions, warnings.

## Backup strategy (Phase 5 target; Phase 4 dry-run plans only)

- Pre-switch, create timestamped backup set of active profile mapped files.
- Write manifest with checksums and file metadata.
- Backup directory should be outside live Codex runtime directory.

## Restore strategy (Phase 5 target)

- Validate target backup manifest before restore.
- Restore atomically where possible (temp + rename).
- Re-verify file metadata and expected checksums.

## Rollback strategy

- If restore or verification fails, rollback using previous active backup set.
- Preserve failed attempt artifacts for doctor diagnostics.
- Keep operation ledger with phase markers and failure reason.

## Lock strategy

- Use durable lock file: `state/switch.lock.json`.
- Include `createdAt`, `pid`, `targetProfileId`, and mode.
- Lock blocks concurrent switch/dry-run operations.
- Doctor reports active vs stale locks.
- Explicit, confirmed clear allowed only for stale locks.

## Failure modes

- Target profile missing in durable store.
- Active profile pointer invalid.
- Lock already held.
- Stale lock after crash.
- Missing planned backup/restore files.
- Permission denied on local filesystem.

## Manual Windows validation checklist

1. Confirm exact Codex profile/auth/session paths on a real Windows machine.
2. Confirm which files are required for a valid signed-in session.
3. Confirm app-closed and app-running behavior for file copy/rename.
4. Validate backup + restore + rollback with non-production account first.
5. Confirm no sensitive file content appears in logs or UI.
