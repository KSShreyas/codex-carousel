# Codex Carousel Overview

Codex Carousel is a background supervisor designed to manage a pool of accounts for Codex sessions. It ensures session continuity by monitoring account health and quotas, rotating accounts when pressure is detected, and cooling down exhausted accounts before returning them to circulation.

## Key Goals
- **High Availability**: Keep a healthy account active at all times.
- **Quota Intelligence**: Track 5-hour and weekly limits to prevent hard exhaustion.
- **Session Continuity**: Use a durable ledger to checkpoint progress and resume work after switching.
- **Safety**: Wait for safe/idle boundaries before performing an auth switch.
- **Operator Control**: Provide deep visibility through a technical dashboard and CLI.
