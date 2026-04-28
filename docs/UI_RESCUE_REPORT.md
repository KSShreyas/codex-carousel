# UI Rescue Report

Date: 2026-04-28

## Scope
UI-only polish pass for final V1 acceptance.

- No backend behavior changes.
- No new backend endpoints.
- No provider/API-key/automatic-switching scope added.

## What was wrong (before)
From `docs/screenshots/before-main-dashboard.png` and related modal screenshots:
- Main surface still looked like a dense utility page.
- Saved accounts were rendered as a table with inline rename controls that looked form-heavy.
- Visual hierarchy was weak for the primary user actions (Add Account / Switch / Open Codex).
- Layout did not feel like a finished premium dashboard shell.

## UI changes made
### 1) Premium dark shell + hierarchy
- Upgraded app backdrop to a subtle radial gradient shell.
- Improved header typography and spacing.
- Added clearer action row with consistent primary/secondary button styling.
- Kept setup badges/status concise and visible.

### 2) Main-content redesign for usability
- Replaced the full-width account table with card-based Saved Accounts tiles.
- Kept account actions clear and local to each card:
  - Switch
  - Update Usage
  - Rename (small section, non-dominant)
- Tightened Current Account, Recommendation, and Recent Activity cards for visual balance.

### 3) Main screen remains user-facing only
- No raw settings fields on the main dashboard.
- No raw diagnostics panels on the main dashboard.
- Advanced/technical controls remain in the Advanced Settings drawer.

### 4) Screenshot/test tooling alignment (UI-only)
- Updated fixture E2E test selector to match card-based layout (no table rows).
- Updated screenshot capture selector for Switch modal opening to avoid table dependency.

## Before / after screenshots
Generated before and after screenshots in `docs/screenshots/`:

### Before
- `before-main-dashboard.png`
- `before-add-account-modal.png`
- `before-switch-account-modal.png`
- `before-advanced-settings.png`

### After
- `after-main-dashboard.png`
- `after-add-account-modal.png`
- `after-switch-account-modal.png`
- `after-advanced-settings.png`

## Self-review
### Main dashboard (after)
PASS
- Looks like a polished dark dashboard rather than raw HTML forms.
- Clear card composition, spacing, typographic hierarchy, and visual rhythm.
- Primary tasks are obvious and immediately usable: Add Account, Open Codex, Switch.

### Add Account modal (after)
PASS
- Flow remains clear and step-based.
- Modal styling fits dashboard shell.

### Switch Account modal (after)
PASS
- Safety Check language remains clear and user-facing.
- Confirmation UX still explicit and safe.

### Advanced Settings (after)
PASS
- Technical details are isolated away from main UI.

## Commands run
- `npm run typecheck` → pass
- `npm test` → pass
- `npm run build` → pass
- `npm run screenshot` → pass

## Final UI verdict
UI rescue objectives met for this pass:
- polished dark app shell,
- card-based dashboard composition,
- cleaner spacing/typography/buttons,
- no raw settings/diagnostics on main screen,
- user-centric Add/Switch/Open experience.
