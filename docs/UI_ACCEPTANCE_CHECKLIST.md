# UI Acceptance Checklist (Phase 8 UX Rescue)

> This checklist is strict. If any item fails, UX is not accepted.

## Product quality gate
- [ ] UI looks like a finished product, not a debug panel.
- [ ] Main dashboard has clear visual hierarchy (header, left summary rail, saved accounts area).
- [ ] Primary actions are obvious: **Add Account**, **Switch Account**, **Open Codex**.

## Language and information architecture gate
- [ ] No raw backend internals appear on the main screen.
- [ ] Main UI does not show raw field names like `localSwitchingEnabled`, `codexProfileRootPath`, `codexLaunchCommand`, etc.
- [ ] Friendly copy is used consistently (Safety Check, Diagnostics, Save This Account, Current Account).
- [ ] Setup required state is friendly and actionable.

## Core flow gate
- [ ] Account switcher flow is understandable end-to-end.
- [ ] Add Account flow is understandable end-to-end.
- [ ] Current account is obvious at a glance.
- [ ] Saved accounts are obvious and scannable.
- [ ] Action buttons are visually distinct by intent (primary/secondary/danger).

## Error and safety gate
- [ ] Error states are friendly and actionable (no raw backend exception dump in primary UI).
- [ ] Switch flow uses friendly Safety Check language.
- [ ] Advanced settings contains technical details; main dashboard does not.

## Visual QA gate (required artifacts)
- [ ] Screenshot generated: Main Dashboard.
- [ ] Screenshot generated: Add Account modal/wizard.
- [ ] Screenshot generated: Switch confirmation modal.
- [ ] Screenshot generated: Advanced Settings/Diagnostics drawer.
- [ ] Screenshots reviewed by Codex against this checklist.

## Engineering gate
- [ ] Build passes.
- [ ] Test suite passes.
- [ ] Typecheck passes.

## Release caution
- [ ] Team explicitly confirms this phase is an audit/design rescue phase and does **not** claim V1 complete.
