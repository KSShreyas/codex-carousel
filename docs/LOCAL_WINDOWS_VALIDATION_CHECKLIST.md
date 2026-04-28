# Local Windows Validation Checklist

Date: 2026-04-28

Use this checklist on a real Windows machine before claiming production readiness.

## Scope note
This validates real local behavior on Windows.
Cloud fixture validation is not a replacement.

## Prerequisites
- Windows host with Codex installed.
- Two real accounts you can test safely.
- Codex Carousel running locally.

## 1) Complete setup in UI
1. Open Codex Carousel.
2. If **Setup Required** appears, click **Set Up Codex**.
3. Confirm Codex data folder.
4. Confirm Codex app path/launch command.
5. Save setup.

## 2) Add Account A
1. Open Codex and sign in as Account A.
2. In Carousel, click **Add Account**.
3. Complete the Add Account flow.
4. Save as **Account A**.

## 3) Add Account B
1. In Codex, sign out/in to Account B.
2. In Carousel, click **Add Account**.
3. Complete the Add Account flow.
4. Save as **Account B**.

## 4) Run Safety Check before switch
1. Click **Switch** on Account B.
2. Verify **Safety Check** shows no blocking issue.
3. Confirm Codex is closed.
4. Click **Switch Account**.

## 5) CLI parity checks
Run:
- `carousel profiles list`
- `carousel switch dry-run <profileBId-or-alias>`
- `carousel switch run <profileBId-or-alias> --confirm`
- `carousel doctor`

Windows fallback:
- `npx.cmd tsx cli.ts switch run <profileBId-or-alias> --confirm`
- `node .\node_modules\tsx\dist\cli.mjs cli.ts switch run <profileBId-or-alias> --confirm`

## 6) Manual verification in Codex
- Launch Codex and confirm visible signed-in identity.
- If verification is unavailable, ensure UI and ledger report that honestly.

## 7) Rollback check
- Simulate/observe a switch failure scenario.
- Confirm rollback events are recorded (`ROLLBACK_STARTED`, `ROLLBACK_COMPLETED` or `ROLLBACK_FAILED`).
- Confirm active account is not incorrectly moved on failed switch.

## 8) Data safety checks
Confirm logs/UI do not expose:
- raw token/session file contents
- passwords
- OAuth secrets

## 9) Final sign-off
Do not mark release complete until all checks above pass on real Windows host.

## Core local flow checklist
- [ ] Click Add Account.
- [ ] Open Codex.
- [ ] Sign in.
- [ ] Close Codex completely.
- [ ] Click Check Again.
- [ ] Save This Account.
- [ ] New account appears in dashboard.
