/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeState, AccountId, PendingSwitchRequest } from './types';
import { Storage } from './storage';

export class RuntimeStore {
  private state: RuntimeState | null = null;

  constructor(private storage: Storage) {}

  async load(): Promise<RuntimeState | null> {
    const loaded = await this.storage.loadJson<RuntimeState>('runtime.json');
    if (loaded) {
      this.state = loaded;
      return loaded;
    }
    // Create default state if none exists
    this.state = this.createDefaultState();
    return this.state;
  }

  private createDefaultState(): RuntimeState {
    return {
      activeAccountId: null,
      drainingAccountId: null,
      previousAccountId: null,
      uptimeStart: new Date().toISOString(),
      lastSwitchAt: null,
      sessionStatus: 'idle',
    };
  }

  getState(): RuntimeState {
    if (!this.state) {
      this.state = this.createDefaultState();
    }
    return this.state;
  }

  setActiveAccount(id: AccountId | null) {
    if (!this.state) this.state = this.createDefaultState();
    this.state.activeAccountId = id;
  }

  setDrainingAccount(id: AccountId | null) {
    if (!this.state) this.state = this.createDefaultState();
    this.state.drainingAccountId = id;
  }

  setPreviousAccount(id: AccountId | null) {
    if (!this.state) this.state = this.createDefaultState();
    this.state.previousAccountId = id;
  }

  setSessionStatus(status: 'idle' | 'busy' | 'switching') {
    if (!this.state) this.state = this.createDefaultState();
    this.state.sessionStatus = status;
  }

  setPendingSwitch(request: PendingSwitchRequest | undefined) {
    if (!this.state) this.state = this.createDefaultState();
    this.state.pendingSwitch = request;
  }

  setLastSwitchAt(timestamp: string) {
    if (!this.state) this.state = this.createDefaultState();
    this.state.lastSwitchAt = timestamp;
  }

  async save() {
    if (!this.state) return;
    await this.storage.saveJson('runtime.json', this.state);
  }

  async onRestart() {
    // On restart, update uptimeStart but preserve other state
    if (this.state) {
      this.state.uptimeStart = new Date().toISOString();
      // Clear any pending switch that was interrupted
      if (this.state.sessionStatus === 'switching') {
        this.state.sessionStatus = 'idle';
        this.state.pendingSwitch = undefined;
      }
      await this.save();
    }
  }
}
