/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AccountId, 
  AccountRegistryRecord, 
  AccountHealthRecord, 
  AccountState, 
  UsageSnapshot, 
  AppConfig 
} from './types';
import { Storage } from './storage';
import { StateMachine } from './stateMachine';
import { logger } from './logging';

export class Registry {
  private accounts: AccountRegistryRecord[] = [];
  private health: Record<AccountId, AccountHealthRecord> = {};
  
  constructor(private storage: Storage, private config: AppConfig) {}

  async load() {
    const accounts = await this.storage.loadJson<AccountRegistryRecord[]>('registry.json');
    if (accounts) this.accounts = accounts;

    const health = await this.storage.loadJson<Record<AccountId, AccountHealthRecord>>('health.json');
    if (health) this.health = health;
    
    // Ensure all accounts have health records
    for (const acc of this.accounts) {
      if (!this.health[acc.id]) {
        this.health[acc.id] = this.createDefaultHealth(acc.id);
      }
    }
  }

  private createDefaultHealth(id: AccountId): AccountHealthRecord {
    return {
      id,
      state: AccountState.Available,
      usage: null,
      lastRefreshAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastFailureKind: null,
      consecutiveFailures: 0,
      cooldownUntil: null,
      recentUseAt: null,
      selectionCount: 0,
      lastSwitchInAt: null,
      lastSwitchOutAt: null,
      recoveryAttempts: 0,
      suspendedReason: null,
    };
  }

  async save() {
    await this.storage.saveJson('registry.json', this.accounts);
    await this.storage.saveJson('health.json', this.health);
  }

  getAccount(id: AccountId) {
    return this.accounts.find(a => a.id === id);
  }

  getAllAccounts() {
    return this.accounts;
  }

  getHealth(id: AccountId) {
    return this.health[id];
  }

  async importAccount(record: Omit<AccountRegistryRecord, 'fingerprint' | 'id'>) {
    const id = record.alias.toLowerCase().replace(/\s+/g, '-');
    const fingerprint = `fp_${id}_${Date.now()}`; // Deterministic but unique fingerprint

    const existing = this.accounts.find(a => a.id === id || a.fingerprint === fingerprint);
    if (existing) {
      logger.log('Account already exists, skipping import', { alias: record.alias });
      return existing;
    }

    const newRecord: AccountRegistryRecord = {
      ...record,
      id,
      fingerprint,
    };

    this.accounts.push(newRecord);
    this.health[id] = this.createDefaultHealth(id);

    await this.save();
    logger.log('Account imported', { id, alias: record.alias, priority: record.priority });
    return newRecord;
  }

  updateHealth(id: AccountId, updates: Partial<AccountHealthRecord>) {
    if (!this.health[id]) {
      this.health[id] = this.createDefaultHealth(id);
    }
    const oldState = this.health[id].state;
    const newState = updates.state ?? oldState;
    
    this.health[id] = { ...this.health[id], ...updates };
    
    // Log state transitions
    if (oldState !== newState) {
      logger.log('Account state transition', { id, from: oldState, to: newState, reason: updates.suspendedReason || 'unknown' });
    }
  }

  async setAccountDisabled(id: AccountId, disabled: boolean) {
    const acc = this.getAccount(id);
    if (acc) {
      acc.disabled = disabled;
      await this.save();
      logger.log('Account disabled toggled', { id, disabled });
    }
  }

  async suspendAccount(id: AccountId, reason: string) {
    this.updateHealth(id, { state: AccountState.Suspended, suspendedReason: reason });
    await this.save();
  }

  async reactivateAccount(id: AccountId) {
    this.updateHealth(id, { 
      state: AccountState.Available, 
      cooldownUntil: null, 
      suspendedReason: null,
      recoveryAttempts: 0,
    });
    await this.save();
  }
}
