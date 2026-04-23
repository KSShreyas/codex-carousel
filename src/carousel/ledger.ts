/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerCheckpoint, AccountId, SwitchReason } from './types';
import { Storage } from './storage';

export class Ledger {
  private current: LedgerCheckpoint | null = null;

  constructor(private storage: Storage) {}

  async load() {
    const latest = await this.storage.loadJson<LedgerCheckpoint>('ledgers/latest.json');
    if (latest) this.current = latest;
  }

  async checkpoint(data: Omit<LedgerCheckpoint, 'id' | 'timestamp'>) {
    const cp: LedgerCheckpoint = {
      ...data,
      id: `cp_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.current = cp;
    await this.storage.saveJson('ledgers/latest.json', cp);
    await this.storage.saveJson(`ledgers/history/${cp.id}.json`, cp);
  }

  getCurrent() {
    return this.current;
  }
}
