# Safety Model (V1.0)

## Core constraints
- No automatic switching.
- No quota bypass automation.
- No API-key workflows.
- No multi-provider routing.

## Switch safety controls
- Local switching disabled by default.
- Real switch requires explicit confirmation.
- Dry-run available before real switch.
- Lock prevents concurrent operations.
- Rollback attempted after post-backup switch failure.

## Sensitive data model
- Frontend receives metadata only.
- Raw auth/session file contents are not returned by APIs.
- Logging redacts token/password/secret-like fields.

## Verification honesty
If safe automated identity verification is unavailable, status is explicitly set to `VerifyUnavailable`.
