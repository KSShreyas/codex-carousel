# 1. Codex Carousel V1.0

Codex Carousel helps you manage multiple local Codex logins and switch between them safely.

## 2. What it does

- Lets you **Add Account** and save local Codex login states.
- Lets you run a **Safety Check** before switching.
- Lets you **Switch Account** only after explicit confirmation.
- Shows **Setup Required** when setup is incomplete.
- Lets you **Open Codex** from the app.
- Lets you manually track usage status and see recommendations.
- Keeps technical details in **Advanced Settings** and **Diagnostics**.

## 3. What it does not do

- No automatic account cycling.
- No password storage.
- No fake usage numbers.
- No fake identity verification claims.
- No cloud upload of raw local profile files.

## 4. Quick start

```bash
npm install
npm run dev
```

Open:
- `http://127.0.0.1:3000`

## 5. First-time setup

If you see **Setup Required**:
1. Click **Set Up Codex**.
2. Scan for Codex.
3. Confirm your Codex data folder.
4. Confirm your Open Codex command (preferred Microsoft Store value: `explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App`).
5. Save setup.

When setup is complete, switching can be enabled safely.

## 6. Add your first Codex account

1. Click **Add Account**.
2. Click **Open Codex Login**.
3. Sign in to the account you want to save.
4. Click **I Logged In**.
5. Enter **Account Name** and **Plan**.
6. Click **Save This Account**.

## 7. Add another account

Repeat the same **Add Account** flow for each additional login.

## 8. Switch accounts

1. Click **Switch** on a saved account.
2. Review **Safety Check** results.
3. Confirm: **I understand Codex should be closed before switching.**
4. Click **Switch Account**.

If Codex is open, close it first, then run Safety Check again.

## 9. Open Codex

Use **Open Codex** in the header.

If nothing happens, verify setup in **Advanced Settings**.

## 10. Track usage manually

Use **Update Usage** on an account and set:
- 5-hour status
- weekly/plan status
- credits status
- optional reset time and notes

## 11. Recommendations

Recommendations help you decide whether to stay or switch.

Recommendations never switch accounts automatically.

## 12. Advanced Settings and Diagnostics

Use **Advanced Settings** for technical setup and system checks.

You can review:
- Codex data folder
- Open Codex command
- switching safety toggles
- Diagnostics status/issues
- event log

## 13. CLI commands

Common commands:

```bash
npx tsx cli.ts status
npx tsx cli.ts doctor
npx tsx cli.ts profiles list
npx tsx cli.ts switch run <profile> --confirm
```

Windows fallback:

```powershell
npx.cmd tsx cli.ts switch run <profile> --confirm
node .\node_modules\tsx\dist\cli.mjs cli.ts switch run <profile> --confirm
```

## 14. Safety model

- Manual switching only.
- Explicit confirmation required for real switch.
- Safety Check required before switching in UI flow.
- Setup must be complete before switching.
- Rollback is attempted if a switch fails after backup.

See also: `docs/SAFETY_MODEL.md`

## 15. Troubleshooting

See: `docs/TROUBLESHOOTING.md`

Common topics:
- Setup Required
- Safety Check failed
- Codex appears to be open
- Open Codex button does nothing
- CLI command issues in PowerShell

## 16. Known limitations

- Real identity verification may be unavailable in some environments.
- Codex local file layout can vary by machine/version.
- Cloud fixture tests do not replace real local Windows validation.

## 17. Local Windows validation

Before calling V1 complete, run local-machine validation:
- `docs/LOCAL_WINDOWS_VALIDATION_CHECKLIST.md`

## 18. Release checklist

Before release:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run e2e:ui`
- `npm run screenshot`

Install Playwright browser deps when needed:

```bash
npx playwright install --with-deps chromium
```

Do **not** claim real Windows switching validation from cloud fixture tests alone.

## Local Add Account flow (real user path)
1. Click **Add Account**.
2. Click **Open Codex**.
3. Sign in with ChatGPT/OpenAI.
4. Close Codex completely.
5. Click **Check Again**.
6. Enter account name and click **Save This Account**.
7. Confirm the new account appears on the dashboard.

## E2E validation
- Playwright fallback UI tests: `npm run e2e:ui`
- Screenshot capture: `npm run screenshot`
- Maestro validation:
  - `npm run maestro:check`
  - `npm run maestro:test`
