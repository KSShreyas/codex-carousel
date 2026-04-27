/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountId, UsageSnapshot, AccountState, AppConfig, SwitchReason, UsageConfidence } from './types';
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
            // Phase 1 scope lock: never auto-switch profiles.
            // Keep recommendation signal for explicit manual action only.
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
          // Phase 1 scope lock: do not perform fake cooldown recovery.
          // Leave profile in Recovering until explicit operator action.
          logger.log('Recovery pending manual verification', { id: acc.id, attempts: currentAttempts });
        }
      }
    }
  }

  /**
   * Refresh usage from observed provider.
   * Phase 1 scope lock: normal mode must not generate fake usage.
   * In demo mode only, caller may provide simulated data explicitly.
   */
  async refreshUsage(id: AccountId, observed?: Omit<UsageSnapshot, 'timestamp' | 'confidence'>): Promise<UsageSnapshot | null> {
    if (!observed) {
      return null;
    }
    if (!this.config.demoMode && observed.five_hour_remaining < 0) {
      throw new Error('Invalid observed usage payload');
    }

    const next: UsageSnapshot = {
      ...observed,
      timestamp: new Date().toISOString(),
      confidence: this.config.demoMode ? UsageConfidence.SimulatedDemo : UsageConfidence.Observed,
    };

    this.registry.updateHealth(id, { usage: next, lastRefreshAt: new Date().toISOString() });
    await this.registry.save();
    return next;
  }
}
