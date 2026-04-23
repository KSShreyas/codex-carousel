/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountState, AccountHealthRecord, FailureKind } from './types';

export class StateMachine {
  private static ALLOWED_TRANSITIONS: Record<AccountState, AccountState[]> = {
    [AccountState.Available]: [AccountState.Active, AccountState.Suspended, AccountState.Disabled],
    [AccountState.Active]: [AccountState.Draining, AccountState.Suspended, AccountState.Disabled],
    [AccountState.Draining]: [AccountState.CoolingDown, AccountState.Suspended, AccountState.Disabled],
    [AccountState.CoolingDown]: [AccountState.Recovering, AccountState.Suspended, AccountState.Disabled],
    [AccountState.Recovering]: [AccountState.Available, AccountState.CoolingDown, AccountState.Suspended, AccountState.Disabled],
    [AccountState.Suspended]: [AccountState.Recovering, AccountState.Disabled],
    [AccountState.Disabled]: [AccountState.Recovering, AccountState.Available],
  };

  static canTransition(from: AccountState, to: AccountState): boolean {
    if (from === to) return true;
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static transition(health: AccountHealthRecord, nextState: AccountState, reason: string): AccountHealthRecord {
    if (!this.canTransition(health.state, nextState)) {
      throw new Error(`Invalid transition from ${health.state} to ${nextState}`);
    }

    return {
      ...health,
      state: nextState,
      lastRefreshAt: new Date().toISOString(),
      // Specific logic for states
      ...(nextState === AccountState.Active && { lastSwitchInAt: new Date().toISOString(), selectionCount: health.selectionCount + 1 }),
      ...(nextState === AccountState.CoolingDown && { lastSwitchOutAt: new Date().toISOString() }),
    };
  }
}
