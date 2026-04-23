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
        if (new Date(health.cooldownUntil) <= new Date()) {
          logger.log('Cooldown expired, probing recovery', { id: acc.id });
          this.registry.updateHealth(acc.id, { state: AccountState.Recovering });
          // Simulation: recover immediately
          setTimeout(() => {
            this.registry.updateHealth(acc.id, { state: AccountState.Available, cooldownUntil: null });
          }, 2000);
        }
      }
    }
  }

  /**
   * Simulated usage refresh
   */
  async refreshUsage(id: AccountId): Promise<UsageSnapshot> {
    const health = this.registry.getHealth(id);
    const current = health?.usage ?? { 
      five_hour_remaining: 50, 
      five_hour_total: 50, 
      weekly_remaining: 200, 
      weekly_total: 200, 
      timestamp: new Date().toISOString() 
    };

    // Simulate some usage
    const next: UsageSnapshot = {
      ...current,
      five_hour_remaining: Math.max(0, current.five_hour_remaining - Math.floor(Math.random() * 5)),
      timestamp: new Date().toISOString(),
    };

    this.registry.updateHealth(id, { usage: next, lastRefreshAt: new Date().toISOString() });
    return next;
  }
}
