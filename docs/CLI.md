# CLI Reference

Codex Carousel provides a powerful CLI for operators. Built with `commander`.

## Commands

### `status`
Show current supervisor and account pool status.

### `list`
Tabular view of all accounts and their health.

### `rotate`
Trigger an immediate manual account rotation.

### `import <alias> [-p priority]`
Import a new account from the inbox.

### `suspend <id> [-r reason]`
Manually suspend an account.

### `reactivate <id>`
Return a suspended or cooling account to circulation.

### `disable <id>`
Toggle the manual lock status of an account.

### `ledger`
Inspect the current durable checkpoint.

### `doctor`
Run system-wide health checks.
