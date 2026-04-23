# Codex Carousel Architecture

The system is built with a decoupled, adapter-based architecture to allow for future integration with diverse environments.

## Components

### Registry
Manages the list of accounts and their current fingerprints. It provides a source of truth for account metadata.

### Health Store
Persists real-time health data, including usage snapshots, failure counts, and cooldown timers for every account in the pool.

### Arbiter
Rules-based selection engine. It scores available accounts based on priority, fair rotation, and historical reliability.

### Ledger
A durable transaction log that stores session state. It allows the system to "remember" what the user was doing and resume efficiently.

### Bridge
The coordination layer. It monitors the active session's idleness, executes the rotation sequence, and verifies that the new identity is active before resuming work.

### Monitor
A background process that periodically refreshes telemetry and triggers the arbiter when rotation is needed.
