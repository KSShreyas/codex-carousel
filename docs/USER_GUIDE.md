# User Guide (V1.0)

## 1) Start
1. `npm install`
2. `npm run dev`
3. Open `http://127.0.0.1:3000`

## 2) Complete setup first (Set Up Codex)
If the app shows **Setup Required**, click **Set Up Codex**.

Wizard flow:
1. **Find Codex** → click **Scan for Codex**.
2. **Confirm Data Folder** → set **Codex data folder**.
3. **Confirm Launch Command** → set **Codex app path or launch command**.
4. **Finish Setup** → click **Save Setup**.

Notes:
- The app does not ask for your OpenAI password.
- The app does not read or display raw auth/session file contents.

## 3) Add accounts
Use the wizard:
1. Click **Add Account**.
2. In step **Open Codex Login**, click **Open Codex Login**.
3. Sign in with the ChatGPT/OpenAI account you want to save.
4. Click **I Logged In**.
5. Enter **Account Name** and select **Plan**.
6. Click **Save This Account**.

After save, the app shows **Account Saved** and **Ready to Switch**.

## 4) Update usage manually
Use **Update Usage** for a saved account and fill:
- 5H window status
- weekly/plan status
- credits status
- reset time (optional)
- note (optional)
- source

Then save and recommendations will recompute.

## 5) Switch account safely
1. Click **Switch Account** on a saved account.
2. Run **Safety Check**.
3. Confirm the checkbox.
4. Click **Switch Account**.

The final switch button is disabled until safety check + confirmation are complete.

## 6) Open Codex
Use **Open Codex** to launch Codex using your configured app path/command.
If launch path is missing, run setup or update it in Advanced Settings.

## 7) Advanced Settings / Diagnostics
Advanced Settings contains technical setup details:
- Codex data folder
- Codex app path
- switching safety toggles
- diagnostics summary
- full event log

Main dashboard stays user-facing and does not expose raw backend field names.

## 8) Real-world validation requirement
Even after tests pass, real profile switching must be validated locally on the target machine.
