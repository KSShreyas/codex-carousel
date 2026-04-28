# Safety Model

Codex Carousel is designed to be safe, explicit, and honest.

## Manual switching only
- The app does not switch accounts automatically.
- The user must explicitly choose a target account and confirm.

## No automatic cycling
- Recommendations are advisory only.
- No background auto-rotation or auto-switch behavior.

## No password storage
- The app does not ask for or store account passwords.

## No fake usage
- Usage values come from manual updates.
- The app does not invent usage numbers.

## No fake identity verification
- If automatic identity verification is unavailable, the app reports that clearly.
- It does not claim verified identity when verification is unavailable.

## Raw profile files never sent to UI
- The UI receives friendly status summaries.
- Raw local profile/auth file contents are not displayed on the main UI.

## Local switching disabled until setup
- Switching remains disabled until setup is complete.
- **Setup Required** is shown when configuration is incomplete.

## Safety Check before switch
- Safety Check summarizes readiness before switching.
- If issues are found, switch stays blocked until fixed.

## Rollback on failure
- If a switch fails after backup, rollback is attempted.
- Events are recorded in the ledger for traceability.
