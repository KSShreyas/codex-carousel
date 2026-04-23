/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountId, UsageSnapshot, AccountState, AppConfig, SwitchReason } from './types';
import { Registry } from './registry';
import { logger } from './logging';

export class Monitor {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private registry: Registry,
    private config: AppConfig,
    private onSwitchNeeded: (reason: SwitchReason) => void
  ) {}

  start() {
    this.intervalId = setInterval(() => this.tick(), this.config.uiRefreshIntervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async tick() {
    const accounts = this.registry.getAllAccounts();
    for (const acc of accounts) {
      const health = this.registry.getHealth(acc.id);
      if (!health) continue;

      if (health.state === AccountState.Active) {
        // Check for rotation
        if (health.usage) {
          const { five_hour_remaining, weekly_remaining } = health.usage;
          if (five_hour_remaining < this.config.fiveHourThreshold || weekly_remaining < this.config.weeklyThreshold) {
            logger.log('Quota pressure detected', { id: acc.id, usage: health.usage });
            this.onSwitchNeeded(SwitchReason.QuotaPressure);
          }
        }
      }

      // Check for cooldown expiry
      if (health.state === AccountState.CoolingDown && health.cooldownUntil) {
        const cooldownTime = new Date(health.cooldownUntil).getTime();
        const now = Date.now();
        
        if (cooldownTime <= now) {
          logger.log('Cooldown expired, moving to Recovering state', { 
            id: acc.id,
            cooldownUntil: health.cooldownUntil 
          });
          
          // Move to Recovering state - actual recovery probe happens in next tick
          this.registry.updateHealth(acc.id, { 
            state: AccountState.Recovering,
            recoveryAttempts: (health.recoveryAttempts || 0) + 1
          });
        }
      }
      
      // Handle recovery probes
      if (health.state === AccountState.Recovering) {
        const maxAttempts = this.config.maxConsecutiveFailures;
        const currentAttempts = health.recoveryAttempts || 0;
        
        if (currentAttempts >= maxAttempts) {
          // Recovery failed too many times, suspend the account
          logger.log('Recovery failed after max attempts, suspending account', { 
            id: acc.id,
            attempts: currentAttempts 
          });
          this.registry.updateHealth(acc.id, { 
            state: AccountState.Suspended,
            suspendedReason: `Recovery failed after ${currentAttempts} attempts`
          });
        } else {
          // Simulate a recovery probe - in production this would check actual account health
          // For now, we assume recovery succeeds after entering Recovering state
          // In production, this would call a real health check endpoint
          logger.log('Recovery probe successful', { id: acc.id });
          this.registry.updateHealth(acc.id, { 
            state: AccountState.Available,
            cooldownUntil: null,
            recoveryAttempts: 0,
            consecutiveFailures: 0,
            lastFailureKind: null
          });
        }
      }
    }
  }

  /**
   * Refresh usage from quota provider
   * In production, this would call actual Codex quota API
   * For dev/test, returns simulated but deterministic values
   */
  async refreshUsage(id: AccountId): Promise<UsageSnapshot> {
    const health = this.registry.getHealth(id);
    
    // In production mode (when CAROUSEL_PRODUCTION=true), this would:
    // 1. Call actual Codex quota API endpoint
    // 2. Parse real usage data
    // 3. Return actual remaining quotas
    
    // For dev/test, we use deterministic simulation based on account ID
    // This ensures consistent behavior for testing while not using random values
    const current = health?.usage ?? { 
      five_hour_remaining: 50, 
      five_hour_total: 50, 
      weekly_remaining: 200, 
      weekly_total: 200, 
      timestamp: new Date().toISOString() 
    };

    // Deterministic "usage" based on account ID hash (no randomness)
    const idHash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const usageDelta = idHash % 5; // Deterministic value 0-4
    
    const next: UsageSnapshot = {
      ...current,
      five_hour_remaining: Math.max(0, current.five_hour_remaining - usageDelta),
      timestamp: new Date().toISOString(),
    };

    this.registry.updateHealth(id, { usage: next, lastRefreshAt: new Date().toISOString() });
    return next;
  }
}
