# Architecture (V1.0)

## Single source of truth
Backend durable store (`durable-state.json`) owns profiles, snapshots, ledger, and settings.

## Components
- `server.ts`: REST API + Vite integration.
- `src/carousel/durableStore.ts`: persistent state.
- `src/carousel/switchEngine.ts`: capture, dry-run, real switch, rollback, lock.
- `src/carousel/recommendations.ts`: recommendation computation.
- `src/App.tsx`: operator dashboard consuming backend APIs.
- `cli.ts`: API-only CLI.

## Safety path
1. Capture profile snapshot.
2. Manual usage snapshot update.
3. Dry-run switch.
4. Explicit confirmation.
5. Real switch + rollback if needed.
6. Manual identity verification.
