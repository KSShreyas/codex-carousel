# Codex Carousel (V1 Scope)

Codex Carousel is a **local, manual, explicit Codex Profile switcher** for users with multiple legitimate ChatGPT-login Codex profiles.

## V1 principles

- Codex-only (no multi-provider routing).
- Manual profile switching only.
- No automatic account/profile cycling.
- No quota bypassing behavior.
- No hidden switching.
- Backend is the source of truth for local state.

## Current status

This repository is in a scope-reset phase.

- ✅ Local backend + CLI + UI exist.
- ✅ Durable local registry/runtime/ledger persistence exists.
- ⚠️ Real Windows profile file switching is **not implemented yet**.
- ⚠️ Production-ready live profile switching is deferred until dry-run + rollback safety are implemented.

## Run locally

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000` and serves both API and UI.

## Useful commands

```bash
npm run lint
npm test
```

## Demo mode

Demo mode is **off by default**.

Set:

```bash
CAROUSEL_DEMO_MODE=true
```

Only then may demo profile data be seeded.
