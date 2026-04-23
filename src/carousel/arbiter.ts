/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AccountId, 
  AccountRegistryRecord, 
  AccountHealthRecord, 
  AccountState, 
  SelectionDecision, 
  SwitchReason, 
  AppConfig 
} from './types';

export class Arbiter {
  constructor(private config: AppConfig) {}

  selectNext(
    candidates: AccountRegistryRecord[], 
    healthMap: Record<AccountId, AccountHealthRecord>,
    activeId: AccountId | null
  ): SelectionDecision {
    const scores: Record<AccountId, number> = {};
    const breakdowns: string[] = [];

    const eligible = candidates.filter(acc => {
      const health = healthMap[acc.id];
      if (!health) return false;
      if (acc.disabled) return false;
      if (health.state !== AccountState.Available) return false;
      if (acc.id === activeId) return false;
      
      // Cooldown check
      if (health.cooldownUntil && new Date(health.cooldownUntil) > new Date()) return false;
      
      return true;
    });

    if (eligible.length === 0) {
      throw new Error("No eligible accounts available for rotation.");
    }

    // Scoring
    for (const acc of eligible) {
      let score = 1000;
      const health = healthMap[acc.id]!;

      // 1. Priority
      score += acc.priority * 100;

      // 2. Recent use penalty
      if (health.recentUseAt) {
        const hoursSinceUse = (Date.now() - new Date(health.recentUseAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceUse < 24) {
          score -= this.config.recentUsePenalty * (1 - hoursSinceUse / 24);
        }
      }

      // 3. Failure penalty
      score -= health.consecutiveFailures * this.config.failurePenalty;

      // 4. Fair rotation
      if (this.config.fairRotation) {
        score -= health.selectionCount * 10;
      }

      scores[acc.id] = score;
    }

    // Find best
    const sorted = eligible.sort((a, b) => scores[b.id] - scores[a.id]);
    const selected = sorted[0];

    return {
      selectedId: selected.id,
      reason: SwitchReason.QuotaPressure, // Default
      isHard: false,
      scores,
      breakdown: sorted.map(a => `${a.alias}: ${scores[a.id].toFixed(0)}`).join(', '),
    };
  }
}
