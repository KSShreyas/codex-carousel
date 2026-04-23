/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Arbiter } from '../src/carousel/arbiter';
import { loadConfig } from '../src/carousel/config';
import { 
  AccountRegistryRecord, 
  AccountHealthRecord, 
  AccountState, 
  SwitchReason 
} from '../src/carousel/types';

describe('Arbiter', () => {
  const config = loadConfig();
  const arbiter = new Arbiter(config);

  const mockAccounts: AccountRegistryRecord[] = [
    { id: 'acc1', alias: 'Acc 1', fingerprint: 'f1', sourcePath: 'p1', priority: 1, disabled: false, metadata: {} },
    { id: 'acc2', alias: 'Acc 2', fingerprint: 'f2', sourcePath: 'p2', priority: 5, disabled: false, metadata: {} },
    { id: 'acc3', alias: 'Acc 3', fingerprint: 'f3', sourcePath: 'p3', priority: 1, disabled: false, metadata: {} },
  ];

  const mockHealth: Record<string, AccountHealthRecord> = {
    'acc1': { id: 'acc1', state: AccountState.Available, usage: null, lastRefreshAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureKind: null, consecutiveFailures: 0, cooldownUntil: null, recentUseAt: null, selectionCount: 0, lastSwitchInAt: null, lastSwitchOutAt: null, recoveryAttempts: 0, suspendedReason: null },
    'acc2': { id: 'acc2', state: AccountState.Available, usage: null, lastRefreshAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureKind: null, consecutiveFailures: 0, cooldownUntil: null, recentUseAt: null, selectionCount: 0, lastSwitchInAt: null, lastSwitchOutAt: null, recoveryAttempts: 0, suspendedReason: null },
    'acc3': { id: 'acc3', state: AccountState.Available, usage: null, lastRefreshAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureKind: null, consecutiveFailures: 0, cooldownUntil: null, recentUseAt: null, selectionCount: 0, lastSwitchInAt: null, lastSwitchOutAt: null, recoveryAttempts: 0, suspendedReason: null },
  };

  it('selects the account with highest priority', () => {
    const decision = arbiter.selectNext(mockAccounts, mockHealth, null);
    expect(decision.selectedId).toBe('acc2');
  });

  it('excludes the active account', () => {
    const decision = arbiter.selectNext(mockAccounts, mockHealth, 'acc2');
    expect(decision.selectedId).not.toBe('acc2');
  });

  it('excludes cooling accounts', () => {
    const healthWithCooling = {
        ...mockHealth,
        'acc2': { ...mockHealth['acc2'], state: AccountState.CoolingDown }
    };
    const decision = arbiter.selectNext(mockAccounts, healthWithCooling, null);
    expect(decision.selectedId).not.toBe('acc2');
  });

  it('applies selection count penalty (fair rotation)', () => {
    const healthWithUsage = {
        ...mockHealth,
        'acc1': { ...mockHealth['acc1'], selectionCount: 10 },
        'acc3': { ...mockHealth['acc3'], selectionCount: 0 }
    };
    // acc1 and acc3 have same priority (1), but acc1 has been used 10 times
    const decision = arbiter.selectNext(mockAccounts.filter(a => a.id !== 'acc2'), healthWithUsage, null);
    expect(decision.selectedId).toBe('acc3');
  });
});
