# Phase 1 Cleanup Report

Date: 2026-04-27

## Files changed

- `.env.example`
- `README.md`
- `cli.ts`
- `index.html`
- `package.json`
- `package-lock.json`
- `server.ts`
- `src/App.tsx`
- `src/carousel/bridge.ts`
- `src/carousel/config.ts`
- `src/carousel/monitor.ts`
- `src/carousel/registry.ts`
- `src/carousel/types.ts`
- `tests/integration.test.ts`
- `tests/ui-language.test.ts` (new)
- `tests/metadata-and-readme.test.ts` (new)
- `docs/V1_SCOPE_LOCK.md` (new)
- `docs/CODEX_PROFILE_SWITCHER_SCOPE_RESET.md` (updated by reference only)
- `metadata.json` (removed)

## Systems removed

- AI Studio/Gemini scaffold text in README, env template, and app title.
- Gemini env wiring from Vite config.
- AI Studio metadata artifact (`metadata.json`).
- Legacy `react-example` package naming.
- Generated fallback auth source paths.

## Systems disabled

- Automatic switching execution from monitor callback.
- Fake usage generation in normal mode.
- Fake cooldown recovery progression in monitor.
- Legacy `/api/rotate` endpoint (now returns 410 with migration message).

## Remaining legacy names

- Internal model/type names still use “Account” in code paths and data models.
- Legacy docs under `docs/OVERVIEW.md`, `docs/ARCHITECTURE.md`, and `docs/STATE_MACHINE.md` still use some pre-reset language and should be rewritten in Phase 2+.

## Risks

- Real Windows profile switching is still not implemented.
- Manual switch currently records internal state transitions and does not perform verified live identity switching.
- Existing integration tests still validate orchestration behavior, but not full Windows-local adapter semantics.

## Commands/tests run

- `npm install`
- `npm test`
- `npm run lint`

## Remaining tasks for Phase 2

- Durable profile capture workflow and ledger/event hardening.
- Dedicated immutable switch-event journal.
- Stronger API validation and schema versioning.
- Full docs rewrite for non-legacy terminology and operational runbooks.
