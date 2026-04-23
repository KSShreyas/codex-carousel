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
  AppConfig,
  FailureKind
} from './types';
import { Storage } from './storage';
import { StateMachine } from './stateMachine';
import { logger } from './logging';

export class Registry {
  private accounts: Map<AccountId, AccountRegistryRecord> = new Map();
  private health: Map<AccountId, AccountHealthRecord> = new Map();
  
  constructor(private storage: Storage, private config: AppConfig) {}

  async load() {
    const accountsList = await this.storage.loadJson<AccountRegistryRecord[]>('registry.json');
    if (accountsList) {
      this.accounts = new Map(accountsList.map(a => [a.id, a]));
    }

    const healthObj = await this.storage.loadJson<Record<AccountId, AccountHealthRecord>>('health.json');
    if (healthObj) {
      this.health = new Map(Object.entries(healthObj));
    }
    
    // Ensure all accounts have health records
    for (const acc of this.accounts.values()) {
      if (!this.health.has(acc.id)) {
        this.health.set(acc.id, this.createDefaultHealth(acc.id));
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
    await this.storage.saveJson('registry.json', Array.from(this.accounts.values()));
    await this.storage.saveJson('health.json', Object.fromEntries(this.health));
  }

  getAccount(id: AccountId): AccountRegistryRecord | undefined {
    return this.accounts.get(id);
  }

  getAllAccounts(): AccountRegistryRecord[] {
    return Array.from(this.accounts.values());
  }

  getHealth(id: AccountId): AccountHealthRecord | undefined {
    return this.health.get(id);
  }

  getHealthMap(): Record<AccountId, AccountHealthRecord> {
    return Object.fromEntries(this.health);
  }

  async importAccount(record: Omit<AccountRegistryRecord, 'fingerprint' | 'id'>): Promise<AccountRegistryRecord> {
    const id = record.alias.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fingerprint = `fp_${Buffer.from(record.sourcePath).toString('base64').slice(0, 16)}`;

    // Check for dedupe by fingerprint first (primary key), then by id
    for (const acc of this.accounts.values()) {
      if (acc.fingerprint === fingerprint) {
        logger.log('Account import deduped by fingerprint', { existingId: acc.id, alias: record.alias });
        return acc;
      }
    }

    // Check if id already exists (different source path but same alias slug)
    const existingById = this.accounts.get(id);
    if (existingById) {
      logger.log('Account import deduped by id', { existingId: id, alias: record.alias });
      return existingById;
    }

    const newRecord: AccountRegistryRecord = {
      ...record,
      id,
      fingerprint,
    };

    this.accounts.set(id, newRecord);
    this.health.set(id, this.createDefaultHealth(id));

    await this.save();
    logger.log('Account imported', { id, alias: record.alias, priority: record.priority });
    return newRecord;
  }

  updateHealth(id: AccountId, updates: Partial<AccountHealthRecord>) {
    if (!this.health.has(id)) {
      this.health.set(id, this.createDefaultHealth(id));
    }
    const current = this.health.get(id)!;
    const oldState = current.state;
    const newState = updates.state ?? oldState;
    
    this.health.set(id, { ...current, ...updates });
    
    // Log state transitions
    if (oldState !== newState) {
      logger.log('Account state transition', { id, from: oldState, to: newState, reason: updates.suspendedReason || 'unknown' });
    }
  }

  async setAccountDisabled(id: AccountId, disabled: boolean) {
    const acc = this.getAccount(id);
    if (acc) {
      acc.disabled = disabled;
      this.accounts.set(id, acc);
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

  async deleteAccount(id: AccountId): Promise<boolean> {
    const deleted = this.accounts.delete(id);
    this.health.delete(id);
    if (deleted) {
      await this.save();
      logger.log('Account deleted', { id });
    }
    return deleted;
  }

  async rebuildFromDisk(inboxDir: string) {
    // In a real implementation, this would scan the inbox directory
    // For now, we just log the action
    logger.log('Registry rebuild requested', { inboxDir });
  }

  async recordFailure(id: AccountId, kind: FailureKind) {
    const health = this.health.get(id);
    if (!health) return;
    
    const newFailures = health.consecutiveFailures + 1;
    this.updateHealth(id, {
      lastFailureAt: new Date().toISOString(),
      lastFailureKind: kind,
      consecutiveFailures: newFailures,
    });
    await this.save();
  }

  async recordSuccess(id: AccountId) {
    const health = this.health.get(id);
    if (!health) return;
    
    this.updateHealth(id, {
      lastSuccessAt: new Date().toISOString(),
      consecutiveFailures: 0,
      lastFailureKind: null,
    });
    await this.save();
  }
}
