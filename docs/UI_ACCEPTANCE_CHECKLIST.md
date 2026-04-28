# UI Acceptance Checklist (Phase 8 UX Rescue)

> This checklist is strict. If any item fails, UX is not accepted.

## Product quality gate
- [x] UI looks like a finished product, not a debug panel.
- [x] Main dashboard has clear visual hierarchy (header, left summary rail, saved accounts area).
- [x] Primary actions are obvious: **Add Account**, **Switch Account**, **Open Codex**.

## Language and information architecture gate
- [x] No raw backend internals appear on the main screen.
- [x] Main UI does not show raw field names like `localSwitchingEnabled`, `codexProfileRootPath`, `codexLaunchCommand`, etc.
- [x] Friendly copy is used consistently (Safety Check, Diagnostics, Save This Account, Current Account).
- [x] Setup required state is friendly and actionable.

## Core flow gate
- [x] Account switcher flow is understandable end-to-end.
- [x] Add Account flow is understandable end-to-end.
- [x] Current account is obvious at a glance.
- [x] Saved accounts are obvious and scannable.
- [x] Action buttons are visually distinct by intent (primary/secondary/danger).

## Error and safety gate
- [x] Error states are friendly and actionable (no raw backend exception dump in primary UI).
- [x] Switch flow uses friendly Safety Check language.
- [x] Advanced settings contains technical details; main dashboard does not.

## Visual QA gate (required artifacts)
- [x] Screenshot generated: Main Dashboard.
- [x] Screenshot generated: Add Account modal/wizard.
- [x] Screenshot generated: Switch confirmation modal.
- [x] Screenshot generated: Advanced Settings/Diagnostics drawer.
- [x] Screenshots reviewed by Codex against this checklist.

## Engineering gate
- [x] Build passes.
- [x] Test suite passes.
- [x] Typecheck passes.

## Release caution
- [x] Team explicitly confirms this phase is an audit/design rescue phase and does **not** claim V1 complete.
