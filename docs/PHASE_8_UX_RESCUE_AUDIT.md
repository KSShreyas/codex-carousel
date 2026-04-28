# PHASE 8 UX RESCUE AUDIT (Blunt)

## Scope audited
- UI implementation: `src/App.tsx`
- Backend API surface: `server.ts`
- CLI commands and labels: `cli.ts`, `docs/CLI.md`
- Existing UI checklist and screenshot script: `docs/UI_ACCEPTANCE_CHECKLIST.md`, `scripts/screenshot.mjs`
- Tests: `tests/ui-language.test.ts` plus switch/parity tests

---

## 1) Current UX problems

### 1.1 Raw technical fields are exposed on the main screen (not acceptable)
**Where it happens:** `src/App.tsx`
- `Settings` card renders raw backend/internal fields directly:
  - `localSwitchingEnabled`
  - `codexProfileRootPath`
  - `codexLaunchCommand`
  - `requireCodexClosedBeforeSwitch`
  - `autoLaunchAfterSwitch`
- `Usage Snapshot` form shows raw schema-level names directly to users:
  - `fiveHourStatus`, `weeklyStatus`, `creditsStatus`, `observedResetAt`, `lastLimitBanner`, `source`
- `Event Ledger` and `Doctor / Safety Status` expose low-level operational output inline on primary UI.

**Why this is bad:** The main surface reads like a backend admin/debug panel, not a user-facing account switcher.

### 1.2 Ugly form layout and overloaded page density
**Where it happens:** `src/App.tsx`
- Too many stacked, full-width-ish forms in left rail (`Usage Snapshot`, `Settings`, switch controls).
- Mixed responsibilities in one screen (capture, usage editing, safety ops, launch, diagnostics, event feed).
- Visual composition is technically “dark theme” but structurally cluttered.

**Why this is bad:** Users cannot quickly understand the primary account-switch task.

### 1.3 Confusing labels and operator jargon
**Where it happens:** `src/App.tsx`, `cli.ts`, `docs/CLI.md`
- Terms such as `Dry Run`, `Doctor`, `Switch Profile`, `Capture Current Login`, `Active Profile Card`, `Usage Snapshot`, `Switch / Capture Controls`.
- CLI mirrors low-level language (`switch dry-run`, `switch clear-lock`, `doctor`, `ledger`) with no consumer-oriented framing.

**Why this is bad:** User mental model is “accounts”, not “profiles + diagnostics primitives”.

### 1.4 Backend errors are shown directly and often raw
**Where it happens:** `src/App.tsx`, `server.ts`
- UI frequently does `setError(data?.error ?? '...')`, which passes backend text directly through.
- Server returns raw `String(error)` in multiple endpoints (`/api/doctor`, `/api/codex/launch`, switch endpoints).

**Why this is bad:** Error UX is unfriendly, inconsistent, and leaks technical internals.

### 1.5 Switch flow confusion
**Where it happens:** `src/App.tsx`
- Switching is split across table row actions and a separate “Switch Panel”.
- Requires users to understand dry-run output internals before actioning.
- Confirmation copy is technical (“Confirm real switch”).

**Why this is bad:** The intended user flow (pick account -> confirm safety -> switch) is not obvious.

### 1.6 Add Account confusion
**Where it happens:** `src/App.tsx`, `server.ts`
- “Add account” does not exist as explicit UX. Instead there is “Capture Current Login” with alias/plan form.
- No visible wizard-like sequence that starts with “Open Codex login flow”.
- Endpoint `/api/profiles/capture-current` is presented as a technical action rather than a user flow step.

**Why this is bad:** Users do not see a clear onboarding path for multi-account setup.

### 1.7 Missing visual hierarchy for the primary task
**Where it happens:** `src/App.tsx`
- Header indicators emphasize backend status/storage/switching flags rather than “Current Account + Add Account + Switch + Open Codex”.
- Primary CTA hierarchy is weak (many same-weight buttons).

**Why this is bad:** The core account-switching flow is buried.

### 1.8 Missing real visual QA process and asset coverage
**Where it happens:** `scripts/screenshot.mjs`, `docs/UI_ACCEPTANCE_CHECKLIST.md`, tests
- Screenshot script currently captures only one generic page (`docs/current-ui.png`).
- No required shots for main dashboard, add modal, switch modal, advanced drawer.
- Existing checklist is shallow and phase-7 oriented.

**Why this is bad:** No strict acceptance loop for UX quality.

### 1.9 Weak tests overfit to text presence
**Where it happens:** `tests/ui-language.test.ts`
- Tests assert string presence in source code (e.g., `'Doctor / Safety Status'`, `'Dry Run'`, `'Capture Current Login'`).
- This locks in undesirable terminology and layout instead of validating behavior and user intent.

**Why this is bad:** Tests currently protect the wrong UX.

---

## 2) Backend concepts that must be hidden from main UI
Move these to **Advanced Settings / Diagnostics** only:
- `localSwitchingEnabled`
- `codexProfileRootPath`
- `codexLaunchCommand`
- `requireCodexClosedBeforeSwitch`
- `autoLaunchAfterSwitch`
- raw doctor output
- raw event ledger
- raw dry-run JSON
- raw switch lock state

Main dashboard must never expose these field names directly.

---

## 3) Main user concepts allowed on main UI
- Current Account
- Add Account
- Switch
- Open Codex
- Saved Accounts
- Usage Status
- Recommendation
- Setup Required
- Safety Check
- Diagnostics

If a label does not help a normal user switch accounts safely, it does not belong on the main surface.

---

## 4) Required simplified screen map

### A. Main Dashboard
- Header with product identity and top-level actions
- Current account summary
- Saved accounts list/grid
- obvious switch action
- simple status + recommendation

### B. Add Account Wizard
- Step 1: Launch/Open Codex login
- Step 2: User logs in externally
- Step 3: Return and Save This Account
- Step 4: confirmation

### C. Switch Confirmation Modal
- Account target
- safety check summary
- confirm switch
- optional “open Codex after switch” CTA

### D. Update Usage Modal
- plain language status update
- no raw schema names

### E. Advanced Settings / Diagnostics Drawer
- technical controls and raw output live here only

---

## 5) Design direction
Adopt a high-quality dark developer dashboard aesthetic, but productized for normal users:
- Near-black background
- Neon green / cyan accents
- Compact type scale
- Card-based composition
- Clear badge semantics
- Clean account table/card grid
- Strong primary action hierarchy
- No raw full-width backend forms on main screen

Inspiration targets:
- Google Stitch style structure quality
- getdesign.md token discipline
- OpenCode-style tool polish
- Raycast-style compactness
- subtle operator-console cues from prior UI, without debug clutter

No dependency on external fetches required for this phase. `DESIGN.md` defines the local design system.

---

## 6) Final dashboard layout (required)

### Header
- Codex Carousel V1.0
- Backend Online / Offline
- Setup Complete / Setup Required
- Current Account
- Add Account
- Open Codex
- Settings gear

### Left column
- Current Account card
- Recommendation card
- Usage summary
- Quick actions

### Main/right column
- Saved Accounts table or card grid
- Switch Account flow
- Recent Activity

### Advanced drawer
- Codex data folder
- Codex app path
- Diagnostics
- raw event log
- reset setup
- safety settings

---

## 7) Friendly copy replacements (required)
- Capture Current Login -> **Save This Account**
- Dry Run -> **Safety Check**
- Doctor -> **Diagnostics**
- Local Switching Disabled -> **Setup Required**
- codexProfileRootPath -> **Codex data folder**
- codexLaunchCommand -> **Codex app path**
- Switch Profile -> **Switch Account**
- Active Codex Profile -> **Current Account**
- Usage Snapshot -> **Update Usage**

---

## 8) Visual QA plan (Codex Cloud)
1. Run the app in local/dev mode.
2. Capture screenshot: Main Dashboard.
3. Capture screenshot: Add Account modal/wizard.
4. Capture screenshot: Switch confirmation modal.
5. Capture screenshot: Advanced Settings/Diagnostics drawer.
6. Inspect each screenshot manually.
7. Compare against `docs/UI_ACCEPTANCE_CHECKLIST.md`.
8. Iterate UI until checklist is fully satisfied.

No release claim without screenshot-backed review.

---

## 9) Test strategy for next phase
Add/replace tests to validate behavior, not static strings:
- Main screen does **not** expose raw backend field names.
- Add Account wizard exists and enforces flow.
- Switch flow uses friendly “Safety Check” language.
- Advanced Settings contains technical fields; main dashboard does not.
- CLI switch command still works.
- Safe defaults remain enforced.
- No fake usage simulation behavior.
- No auto-switching behavior.
- Screenshot generation for required views succeeds.

---

## API and CLI implications (implementation planning notes)

### Backend endpoint grouping recommendation
Keep APIs but classify by UI surface:
- **Main UI-safe:** `/api/status`, `/api/profiles`, `/api/profiles/:id/switch`, `/api/codex/launch`, usage read/update endpoints (with friendly mapping).
- **Advanced/Diagnostics only:** `/api/settings`, `/api/doctor`, `/api/ledger`, `/api/switch/status`, `/api/switch/lock/clear`, dry-run internals.

### CLI command posture for V1 UX
CLI can remain power-user oriented, but docs must clearly separate:
- user-facing app flow vs.
- advanced troubleshooting commands (`doctor`, `ledger`, lock management).

The GUI must not mirror all CLI internals on the main screen.

---

## Bottom line
Current UI is functional but product-wrong. It exposes backend internals, overloads users, and validates the wrong things in tests. Phase 8 must reset the interface into a true account switcher flow before any “V1 complete” claim is credible.
