# Codex Carousel V1.0 Design System (Phase 8)

## 1) Product personality
- **Role:** trustworthy local account switcher, not a backend console.
- **Tone:** confident, concise, technical-but-friendly.
- **UX posture:** “fast, safe, obvious.”
- **Visual character:** dark, polished, compact, operator-grade clarity without exposing internals.

---

## 2) Color tokens

### Base
- `--bg-app`: `#06080B` (near-black)
- `--bg-surface-1`: `#0B0F14`
- `--bg-surface-2`: `#10161D`
- `--bg-elevated`: `#121A23`
- `--border-muted`: `#1F2A36`
- `--border-strong`: `#2C3A4A`

### Text
- `--text-primary`: `#E8EEF5`
- `--text-secondary`: `#A9B7C6`
- `--text-muted`: `#7F90A3`
- `--text-inverse`: `#071015`

### Accents
- `--accent-green`: `#2EEA8B`
- `--accent-cyan`: `#33D1FF`
- `--accent-blue`: `#4C8CFF`

### States
- `--success`: `#29D17D`
- `--warning`: `#FFC85C`
- `--danger`: `#FF6B7A`
- `--info`: `#5AC8FF`

### State backgrounds (for chips/banners)
- `--success-bg`: `rgba(46, 234, 139, 0.12)`
- `--warning-bg`: `rgba(255, 200, 92, 0.12)`
- `--danger-bg`: `rgba(255, 107, 122, 0.14)`
- `--info-bg`: `rgba(90, 200, 255, 0.12)`

---

## 3) Typography
- Font stack: `Inter, Segoe UI, system-ui, sans-serif`
- Optional mono (diagnostics only): `JetBrains Mono, Consolas, monospace`

### Scale
- Display / App title: 24px / 700 / -0.01em
- Section title: 15px / 600
- Card title: 13px / 600 / uppercase optional only for tiny labels
- Body: 13px / 500
- Secondary body: 12px / 500
- Caption/meta: 11px / 500

### Rules
- Avoid all-caps across whole UI. Reserve for micro-badges only.
- Keep line lengths short inside cards.
- Use friendly nouns: Account, Setup, Safety, Diagnostics.

---

## 4) Spacing
- Base unit: `4px`
- Spacing tokens: 4, 8, 12, 16, 20, 24, 32
- Card padding: 16
- Modal padding: 20
- Section gap: 16
- Grid gap: 16
- Dense row height: 40

---

## 5) Card styles
- Radius: 12px
- Border: 1px solid `--border-muted`
- Background: `--bg-surface-1`
- Shadow: `0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px rgba(0,0,0,0.35)`
- Header/footer separators: 1px `--border-muted`
- Hover (interactive cards): slightly brighter border + subtle lift

---

## 6) Button styles

### Primary (Add Account / Switch Account)
- Fill: gradient from `--accent-green` to `--accent-cyan`
- Text: `--text-inverse`
- Height: 36
- Radius: 10
- Weight: 600

### Secondary (Open Codex / Update Usage)
- Fill: transparent
- Border: `--border-strong`
- Text: `--text-primary`

### Danger (Reset / destructive confirmations)
- Fill: `--danger-bg`
- Border: `--danger`
- Text: `#FFD7DD`

### Disabled
- Opacity: 45%
- Cursor: not-allowed
- No hover lift

---

## 7) Badge styles
- Radius: 9999px
- Height: 22
- Padding X: 10
- Font: 11px / 600
- Variants:
  - Online / Complete: success
  - Setup Required: warning
  - Offline / Failed: danger
  - Unknown: muted neutral

---

## 8) Table styles (Saved Accounts)
- Header row sticky inside card body
- Header bg: `--bg-surface-2`
- Row divider: 1px `--border-muted`
- Active/current row highlight: `--info-bg`
- Actions column aligned right
- Primary row action: `Switch`
- Secondary row action: `Update Usage`

Columns:
1. Account name
2. Plan
3. Usage status (friendly badge group)
4. Recommendation
5. Last active
6. Actions

---

## 9) Modal styles
- Overlay: `rgba(2,6,10,0.72)` + mild blur
- Modal width:
  - Add Account Wizard: 640
  - Switch modal: 520
  - Update Usage: 500
- Modal radius: 14
- Modal sections: title / body / footer actions
- Escape closes only non-destructive modals

---

## 10) Error/warning styles

### Inline errors
- Friendly copy first; technical detail optional via “Show details”.
- Example: “Could not switch account. Please run Safety Check and try again.”

### Warnings
- Use warning banner with plain action guidance.
- Example: “Setup Required: choose your Codex data folder in Settings.”

### Never on main dashboard
- Raw exception strings
- JSON dumps
- Stack traces

---

## 11) Empty states

### No saved accounts
- Title: “No saved accounts yet”
- Body: “Add your first account by signing in through Codex, then save it here.”
- CTA: Primary “Add Account”

### No usage data
- Show “Usage unknown” neutral badge + CTA “Update Usage”

### Setup required
- Card-level warning with CTA “Open Settings”

---

## 12) Main dashboard wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Codex Carousel V1.0   [Backend: Online] [Setup: Complete]      (⚙ Settings)│
│ Current Account: jane@...      [Add Account] [Open Codex]                  │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┬──────────────────────────────────────────────┐
│ LEFT COLUMN                   │ RIGHT / MAIN                                │
│                               │                                              │
│ [Current Account Card]        │ [Saved Accounts]                             │
│ - Name / Plan / Last active   │ ┌──────────────────────────────────────────┐ │
│ - Status badges               │ │ Account | Usage | Recommendation | Action│ │
│ - Primary: Switch Account     │ │ ...                                      │ │
│                               │ └──────────────────────────────────────────┘ │
│ [Recommendation Card]         │                                              │
│ - Best next action            │ [Switch Account Flow Summary]                │
│                               │ - Selected target                            │
│ [Usage Summary Card]          │ - Safety Check result                        │
│ - Current limits state        │ - Confirm + Switch                           │
│                               │                                              │
│ [Quick Actions]               │ [Recent Activity]                            │
│ - Add Account                 │ - Human-readable timeline                    │
│ - Open Codex                  │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 13) Add Account wizard wireframe

```text
┌───────────────────────────────────────────────────────────────┐
│ Add Account                                                   │
│ Step 1 of 3                                                   │
├───────────────────────────────────────────────────────────────┤
│ 1) Click "Open Codex Login"                                 │
│ 2) Sign in to ChatGPT/OpenAI in the normal browser flow      │
│ 3) Return here and click "Save This Account"                │
│                                                               │
│ Account Name [____________________]                           │
│ Plan        [Plus ▾]                                          │
│                                                               │
│ [Open Codex Login]                    [Save This Account]     │
└───────────────────────────────────────────────────────────────┘
```

Wizard steps should always map to the real user flow and avoid backend wording.

---

## 14) Switch modal wireframe

```text
┌──────────────────────────────────────────────────────┐
│ Switch Account                                       │
├──────────────────────────────────────────────────────┤
│ You are switching from: Current Account A            │
│ Target account: Saved Account B                      │
│                                                      │
│ Safety Check: PASS                                   │
│ - Codex state backup prepared                        │
│ - No blocking issues detected                        │
│                                                      │
│ [ ] Open Codex after switching                       │
│                                                      │
│ [Cancel]                         [Switch Account]    │
└──────────────────────────────────────────────────────┘
```

If Safety Check fails, disable `Switch Account` and show friendly remediation.

---

## 15) Advanced Settings / Diagnostics wireframe

```text
(Right-side drawer)
┌───────────────────────────────────────────────┐
│ Settings & Diagnostics                        │
├───────────────────────────────────────────────┤
│ Codex data folder   [C:\...\Codex\data   ]  │
│ Codex app path      [C:\...\Codex.exe     ]  │
│                                               │
│ Safety settings                               │
│ [x] Require Codex closed before switch        │
│ [ ] Open Codex after switch                   │
│                                               │
│ Diagnostics                                   │
│ [Run Diagnostics] [View Event Log]            │
│                                               │
│ Advanced (collapsed by default)               │
│ - Raw event log                               │
│ - Switch lock state                           │
│ - Reset setup                                 │
└───────────────────────────────────────────────┘
```

Technical language is allowed in this drawer only, and must be hidden by default where possible.
