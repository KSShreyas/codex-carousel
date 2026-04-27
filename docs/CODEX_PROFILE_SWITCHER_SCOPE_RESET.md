# CODEX PROFILE SWITCHER — Phase 0 Scope Reset Audit

Date: 2026-04-27  
Repository: `KSShreyas/codex-carousel`  
Audit mode: adversarial, evidence-based, no code changes beyond this document.

---

## Executive verdict (blunt)

The current repo is **not yet a compliant Codex Profile Switcher V1**. It contains:

- substantial **AI Studio/Gemini scaffold residue**;
- a working backend/CLI/UI skeleton with durable JSON persistence;
- **simulated usage and mocked switching adapters** that are explicitly non-production;
- an active **automatic switching path** via background monitor callbacks (violates strict manual-only scope);
- no real Windows Codex profile adapter implementation.

This means it is currently a **hybrid prototype**: partially real stateful app + partially mock supervisor behaviors.

---

## 1) Current repo architecture

### Frontend files

- `src/main.tsx` (React app bootstrap).
- `src/App.tsx` (single-page operator dashboard; polls backend and triggers actions).
- `src/index.css` (Tailwind theme + UI styles).
- `src/lib/utils.ts` (class merge helper).
- `index.html` (app shell, still AI Studio title string).

### Backend files

- `server.ts` (Express server, API routes, initializes storage/registry/arbiter/ledger/runtime/bridge/monitor).
- `src/carousel/config.ts` (zod config schema + path resolution).
- `src/carousel/storage.ts` (filesystem JSON persistence abstraction).
- `src/carousel/logging.ts` (console + JSONL log writer/reader).
- `src/carousel/registry.ts` (account registry + health store + import/rebuild/failure tracking).
- `src/carousel/runtime.ts` (runtime state store + restart handling).
- `src/carousel/ledger.ts` (checkpointing with latest + history files).
- `src/carousel/arbiter.ts` (selection/scoring engine).
- `src/carousel/monitor.ts` (periodic health checks, quota pressure detection, cooldown/recovery).
- `src/carousel/bridge.ts` (switch orchestration, adapters, rollback).
- `src/carousel/stateMachine.ts` (state transition constraints; currently mostly not enforced by registry/bridge).
- `src/carousel/types.ts` (shared types/enums/interfaces).

### CLI files

- `cli.ts` (commander-based CLI; calls backend HTTP API only).

### carousel/core files

Treating `src/carousel/*` as core domain layer:

- `types.ts`, `config.ts`, `storage.ts`, `logging.ts`, `registry.ts`, `runtime.ts`, `ledger.ts`, `arbiter.ts`, `monitor.ts`, `bridge.ts`, `stateMachine.ts`.

### Storage files

Storage layer and durable data paths:

- `src/carousel/storage.ts` abstraction.
- Registry + health persisted as `registry.json` and `health.json` under `stateDir`.
- Runtime persisted as `runtime.json`.
- Ledger persisted as `ledgers/latest.json` and `ledgers/history/*.json`.
- Logs persisted as JSONL under configured `logDir` (`carousel.jsonl`).

### Tests

- `tests/arbiter.test.ts` (arbiter unit tests with mock data).
- `tests/integration.test.ts` (registry/ledger/runtime/bridge/monitor integration behaviors using temp dirs and `DevTestAdapter`).

### Config files

- `tsconfig.json`
- `vite.config.ts`
- `.env.example`
- `.gitignore`

### Package metadata

- `package.json`
- `package-lock.json`
- `metadata.json` (AI Studio-style app metadata artifact)

### Docs

- `README.md`
- `docs/OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/STATE_MACHINE.md`
- `docs/CLI.md`

---

## 2) Stale scaffold artifacts (AI Studio / Gemini / starter leftovers)

Confirmed stale or suspicious scaffold residue:

1. **AI Studio/Gemini branding and instructions**
   - `README.md` still says “Run and deploy your AI Studio app,” links an AI Studio app URL, and requires `GEMINI_API_KEY`.
   - `.env.example` contains AI Studio injected env comments and `GEMINI_API_KEY`.
   - `index.html` title is `My Google AI Studio App`.

2. **Gemini-specific dependency and env wiring**
   - `package.json` includes `@google/genai` dependency.
   - `vite.config.ts` defines `process.env.GEMINI_API_KEY` and has AI Studio HMR comment.
   - `package-lock.json` includes `@google/genai` and project name residue.

3. **Starter template naming**
   - `package.json` name is `react-example`.
   - `package-lock.json` root name is `react-example`.

4. **AI Studio metadata artifact**
   - `metadata.json` present at repository root.

5. **Other starter/template residue**
   - `.gitignore` appears to contain literal markdown code fences (leading and trailing ```), indicating likely copied template content rather than clean gitignore.

Conclusion: scaffold cleanup is mandatory in Phase 1.

---

## 3) Fake / simulated systems inventory

### A. Deterministic simulated usage (not real quota source)

- `Monitor.refreshUsage()` states dev/test simulated behavior and computes deterministic usage deltas from account ID hash.
- No real Codex quota provider integration exists.

### B. Simulated recovery behavior

- `Monitor.tick()` moves `Recovering -> Available` via assumed success path (“simulate a recovery probe”).
- This can create false confidence about health.

### C. Mock switching adapter

- `DevTestAdapter` uses time delays and unconditional success (`isIdle` true, `verifyIdentity` true).
- `ProductionAdapterStub` intentionally unimplemented and throws.
- `Bridge` defaults to `DevTestAdapter` when no adapter is supplied.

### D. Automatic switching behavior exists

- `server.ts` wires `Monitor` callback to `bridge.performSwitch(reason)` and starts monitor loop.
- Monitor triggers callback on quota pressure for active account.
- This is an automatic switch path that conflicts with the requested manual-only switch model.

### E. Generated auth file paths / placeholder capture path

- `server.ts` import endpoint falls back to `./auth-${Date.now()}.json` when source path is omitted (except production mode check).
- `registry.ts` also creates `./dev-auth-${Date.now()}.json` fallback.
- These are placeholder/generated paths and not explicit verified profile capture.

### F. “Force Rotate” UX language

- UI button text says `Force Rotate`, which implies potentially unsafe/implicit behavior rather than explicit operator-driven manual switch intent language.

### G. Unconditional success endpoints

- Several API handlers return `{ success: true }` without deep validation (suspend/reactivate/enable/disable/cooldown) and do not always verify account existence before mutation.

---

## 4) Current truth path (answers)

### Is backend the source of truth?

**Mostly yes for runtime data, account registry, health, and ledger**. UI and CLI read through backend APIs. State is loaded/saved from disk by backend services.

### Is UI using backend state or local fake state?

**Backend state** for status/accounts/ledger/logs (`/api/status`, `/api/logs`). No separate UI-side account store found.

### Is CLI calling backend API or creating separate in-memory state?

**CLI calls backend API only** (`http://localhost:3000/api/...`). It does not keep an independent registry.

### Does any state survive process restart?

**Yes**:
- `registry.json` and `health.json` survive restart.
- `runtime.json` survives restart (with restart normalization).
- `ledgers/latest.json` and history survive restart.

### Are logs persisted?

**Yes, conditionally by server init**:
- logger file path is set in server startup and appended as JSONL.
- in-memory ring buffer also exists for recent events.

### Are account/profile events persisted?

**Partially yes**:
- account/health mutations are persisted via registry save calls.
- switch checkpoints are persisted in ledger files.
- event logs are persisted in JSONL.
- there is **no dedicated immutable event journal for every profile switch lifecycle step** beyond logging + ledger snapshot.

### Is there any real profile switching implementation?

**No** real Windows/Codex live switching implementation.
- only `DevTestAdapter` mock and `ProductionAdapterStub` placeholders.

### Is there any unsafe mutation of live local files?

**Not yet in real live-profile sense**, because production adapter is not implemented.  
Potential unsafe future vector exists because `switchAuth(nextPath)` abstraction has no safety gates enforced at bridge level (dry-run/confirm/backup gating not yet implemented).

---

## 5) Subsystem classification

Using required labels.

| Subsystem | Classification | Why |
|---|---|---|
| Config | PARTIAL_KEEP_AND_REWORK | Config schema is useful, but includes quota/cooldown defaults and legacy fields tied to auto-rotation assumptions. |
| Shared types | PARTIAL_KEEP_AND_REWORK | Core types are useful; enums/reasons include auto/quota-driven semantics that exceed manual-only scope. |
| Storage | REAL_AND_KEEP | Atomic-ish JSON save/load/list patterns are already practical for durable local state. |
| Logging | PARTIAL_KEEP_AND_REWORK | Persisted JSONL exists, but logger API is inconsistent (`logger.warn` call exists though no `warn` method). Needs stricter structured event model. |
| Profile registry | PARTIAL_KEEP_AND_REWORK | Durable, dedupe, health map are solid base; import defaults and generated paths violate explicit capture expectations. |
| Runtime state | REAL_AND_KEEP | Persisted runtime with restart handling is aligned with V1 needs. |
| Usage tracking | MOCK_REMOVE | Current usage source is explicitly simulated, not real telemetry. Must be replaced or clearly marked as non-authoritative dev-only mode. |
| Recommendation engine | PARTIAL_KEEP_AND_REWORK | Arbiter/scoring exists, but is wired into auto-switch pipeline and quota assumptions. Keep as recommendation-only logic. |
| Switch engine | PARTIAL_KEEP_AND_REWORK | Orchestration sequence and rollback skeleton are valuable; currently coupled to mock adapters and auto-trigger paths. |
| Windows profile adapter | UNKNOWN_VERIFY | No real adapter implementation exists; must be designed and validated on local Windows with real Codex files. |
| Codex launcher | DEAD_REMOVE | No dedicated launcher subsystem exists despite implied semantics in docs/comments. Remove implied claims or implement intentionally later. |
| Server/API | PARTIAL_KEEP_AND_REWORK | Good foundation, but has auto-switch behavior and permissive mutation routes needing stricter manual/safety controls. |
| CLI | REAL_AND_KEEP | API-only CLI parity foundation is good; needs command refinements for dry-run/safety semantics. |
| UI | PARTIAL_KEEP_AND_REWORK | Reads backend truth, but labels/actions imply force rotation and exposes simulated metrics as real. |
| Tests | PARTIAL_KEEP_AND_REWORK | Good coverage for persistence and orchestration skeleton; heavily mock-based and lacks manual-only policy compliance tests. |
| Docs | MOCK_REMOVE | Current docs describe auto-rotation/quota supervisor behavior inconsistent with final scope; rewrite required. |

---

## 6) Final V1 acceptance criteria (must all pass)

1. No stale Gemini/AI Studio scaffold remains unless intentionally documented.
2. No fake usage/cooldown/limit data is displayed as real.
3. Backend owns durable state.
4. Profiles survive app restart.
5. Ledger survives app restart.
6. CLI and UI use the same backend truth.
7. Profile capture is explicit.
8. Profile switch is explicit/manual.
9. Switch has dry-run mode.
10. Real local file switching is behind safety gates.
11. App never switches accounts automatically.
12. App can recommend but cannot auto-execute switching.
13. App records every switch event.
14. App has rollback plan.
15. Tests cover persistence, restart, CLI/API parity and recommendation safety.

### Compliance interpretation notes

- “Recommend” is allowed; “execute” must require explicit operator action every time.
- Any threshold/quota detector may inform **advice only** and must be labeled as observed/estimated source quality.
- Dry-run output must describe exactly what would change and what safety checks would run.

---

## 7) Phased implementation plan with checklists

## Phase 1 — Cleanup and scope reset

Goal: remove scaffold residue, remove/disable non-compliant auto behavior, align language and docs.

Checklist:

- [ ] Replace AI Studio/Gemini references in README, env examples, HTML title, vite comments, and package metadata.
- [ ] Remove `@google/genai` dependency and related env define if unused.
- [ ] Rename package from `react-example` to project-accurate name.
- [ ] Decide fate of `metadata.json` (remove if AI Studio-only artifact).
- [ ] Fix `.gitignore` malformed code fences.
- [ ] Remove/disable automatic switch execution path from monitor callback wiring.
- [ ] Reword UI/CLI labels from “force rotate” to explicit “manual switch”.
- [ ] Rewrite docs to manual-first, transparency-first, no-circumvention positioning.
- [ ] Add explicit policy statement: no automatic account switching on exhaustion/rate limits.

## Phase 2 — Durable profile store and ledger hardening

Goal: make profile and event durability explicit, auditable, restart-safe.

Checklist:

- [ ] Introduce explicit profile capture flow (no generated auth path fallbacks in production behavior).
- [ ] Enforce account existence checks and robust API validation for mutation endpoints.
- [ ] Add durable switch-event journal (append-only) in addition to latest ledger checkpoint.
- [ ] Persist recommendation snapshots with provenance (source + timestamp + confidence).
- [ ] Define schema versioning/migrations for registry/health/runtime/ledger files.
- [ ] Add crash-consistency tests for partial write scenarios.

## Phase 3 — CLI/API/UI parity

Goal: one truth model and equivalent operator capability across interfaces.

Checklist:

- [ ] Define canonical API contracts for profile list/import/switch/recommend/ledger/events.
- [ ] Ensure CLI and UI call the same endpoints for every action.
- [ ] Remove UI-only implied logic and CLI-only hidden behaviors.
- [ ] Add parity tests comparing CLI/API and UI/API outcomes.
- [ ] Add clear source labels in UI (e.g., observed vs unavailable vs estimated).

## Phase 4 — Dry-run switch engine

Goal: implement operator-visible dry-run planning before any real mutation.

Checklist:

- [ ] Add `/switch/dry-run` API and CLI command.
- [ ] Dry-run must output selected target profile, checks performed, file operations that would run, and rollback strategy.
- [ ] Require explicit confirmation step before non-dry-run execution.
- [ ] Log dry-run requests/results in durable event journal.
- [ ] Test that dry-run performs zero live mutations.

## Phase 5 — Real Windows profile switching behind safety gates

Goal: implement actual Windows local profile switching, gated and reversible.

Checklist:

- [ ] Implement Windows adapter (replace stub) with explicit path allowlists.
- [ ] Add preflight checks: path existence, permissions, lock status, backup readiness.
- [ ] Add mandatory backups and rollback restore mechanics.
- [ ] Add post-switch identity verification with concrete, auditable signals.
- [ ] Add “manual confirm” guardrails in CLI/UI for live switch.
- [ ] Add feature flags to keep live switching disabled by default.
- [ ] Document and test failure/rollback paths.

### Windows-local validation path (cannot be verified in this cloud audit)

The following must be validated on a real Windows machine with installed Codex local environment:

- [ ] Locate actual Codex auth/profile file locations and access semantics.
- [ ] Verify adapter path mappings and file lock behavior.
- [ ] Verify identity switch detection after reload.
- [ ] Perform controlled live switch and rollback drills with real accounts.
- [ ] Capture operator-visible audit logs for each step.

## Phase 6 — Final hardening, docs, tests, release checklist

Goal: production readiness and policy compliance proof.

Checklist:

- [ ] Add policy tests proving no auto-switch execution occurs.
- [ ] Add restart/resilience tests covering profile + ledger + event journal durability.
- [ ] Add recommendation safety tests proving recommendations never execute switch.
- [ ] Add end-to-end CLI/API/UI parity tests.
- [ ] Add security review for local file mutation boundaries.
- [ ] Finalize operator docs/runbooks/troubleshooting.
- [ ] Publish release checklist with sign-off criteria for compliance boundary.

---

## High-risk findings to prioritize immediately

1. **Auto-switch path is active** (monitor callback triggers switch execution). This conflicts with explicit manual-only switching requirement.
2. **Simulated usage/recovery appears operational** and may be interpreted as real.
3. **No real production adapter** exists; current switching success in dev is mock success.
4. **Scaffold residue** risks product confusion and mis-scoping.
5. **Generated source path fallbacks** weaken explicit profile capture guarantees.

---

## Evidence map (key files/functions)

- Auto-switch callback wiring: `server.ts` monitor constructor callback + `monitor.start()`.
- Manual rotate endpoint: `server.ts` `/api/rotate`.
- Generated auth path fallback: `server.ts` `/api/accounts/import` and `registry.importAccount`.
- Simulated usage and recovery: `src/carousel/monitor.ts` (`refreshUsage`, recovery block in `tick`).
- Mock adapter + stub: `src/carousel/bridge.ts` (`DevTestAdapter`, `ProductionAdapterStub`, default adapter selection in `Bridge` constructor).
- Durable state stores: `src/carousel/storage.ts`, `registry.ts`, `runtime.ts`, `ledger.ts`.
- Persisted logs: `src/carousel/logging.ts` and logger initialization in `server.ts`.
- UI backend-driven polling and rotate action: `src/App.tsx`.
- CLI backend-only operations: `cli.ts`.
- AI Studio/Gemini residue: `README.md`, `.env.example`, `index.html`, `vite.config.ts`, `package.json`, `package-lock.json`, `metadata.json`.

