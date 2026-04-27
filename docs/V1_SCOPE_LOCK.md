# V1 Scope Lock — Codex Carousel

This document is a hard scope boundary for V1.

## Locked scope

- Codex-only V1.
- ChatGPT-login profiles only.
- No API-key workflows in V1.
- No multi-provider routing in V1.
- No automatic switching.
- No bypassing rate limits.
- No fake usage data in normal mode.
- Backend is the source of truth.
- Real Windows profile switching is implemented only after dry-run and rollback safety exist.

## Notes

- Demo behavior, if present, must be explicitly enabled via `CAROUSEL_DEMO_MODE=true`.
- Demo mode must never be the default.
