# Account State Machine

Codex Carousel implements a strict state machine for account lifecycle management.

## States
- **Available**: Ready to be used. Healthy and rested.
- **Active**: Currently powering the Codex session.
- **Draining**: Selected for replacement; waiting for a safe boundary.
- **CoolingDown**: Usage limit reached; resting until the quota window resets.
- **Recovering**: Performing a diagnostic probe to verify health after cooldown.
- **Suspended**: Manually taken out of rotation by an operator.
- **Disabled**: Permanently locked (e.g., manual override or critical failure).

## Transitions
- `Available` -> `Active`: When selected by the Arbiter.
- `Active` -> `Draining`: When quota pressure or a manual rotation is triggered.
- `Draining` -> `CoolingDown`: After the switch is verified.
- `CoolingDown` -> `Recovering`: After the `cooldownUntil` timestamp passes.
- `Recovering` -> `Available`: After a successful health probe.
- `Any` -> `Suspended`: On manual `carousel suspend` command.
- `Any` -> `Disabled`: On manual `carousel disable` or fatal auth failure.
