/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AccountId, 
  AccountState, 
  SwitchReason, 
  AppConfig, 
  RuntimeState, 
  BridgeEvent 
} from './types';
import { Registry } from './registry';
import { Arbiter } from './arbiter';
import { Ledger } from './ledger';
import { Monitor } from './monitor';
import { logger } from './logging';
import { StateMachine } from './stateMachine';

export interface IBridgeAdapter {
  isIdle(): Promise<boolean>;
  switchAuth(nextPath: string): Promise<void>;
  verifyIdentity(expectedId: string): Promise<boolean>;
  reloadSession(): Promise<void>;
}

export class Bridge {
  private runtime: RuntimeState = {
    activeAccountId: null,
    drainingAccountId: null,
    uptimeStart: new Date().toISOString(),
    lastSwitchAt: null,
    sessionStatus: 'idle',
  };

  private adapter: IBridgeAdapter;

  constructor(
    private registry: Registry,
    private arbiter: Arbiter,
    private ledger: Ledger,
    private config: AppConfig
  ) {
    // Default Mock Adapter
    this.adapter = {
      isIdle: async () => true, // Simulation
      switchAuth: async (path) => logger.log('Adapter: Switched auth file', { path }),
      verifyIdentity: async (id) => true,
      reloadSession: async () => logger.log('Adapter: Reloaded session'),
    };
  }

  setAdapter(adapter: IBridgeAdapter) {
    this.adapter = adapter;
  }

  getRuntime() {
    return this.runtime;
  }

  async initialize() {
    await this.registry.load();
    await this.ledger.load();
    
    // Recovery from crash: find active account
    const accounts = this.registry.getAllAccounts();
    const active = accounts.find(a => this.registry.getHealth(a.id).state === AccountState.Active);
    if (active) {
      this.runtime.activeAccountId = active.id;
    }
  }

  async performSwitch(reason: SwitchReason) {
    if (this.runtime.sessionStatus === 'switching') {
      logger.log('Switch already in progress, ignoring request');
      return;
    }

    this.runtime.sessionStatus = 'switching';
    const prevId = this.runtime.activeAccountId;
    
    try {
      // 1. Selection
      const decision = this.arbiter.selectNext(
        this.registry.getAllAccounts(), 
        Object.fromEntries(this.registry.getAllAccounts().map(a => [a.id, this.registry.getHealth(a.id)])),
        prevId
      );

      logger.log('Switch sequence started', { from: prevId, to: decision.selectedId, reason: decision.reason });

      // 2. Wait for Idle
      let attempts = 0;
      while (!(await this.adapter.isIdle()) && attempts < 30) {
        logger.log('Waiting for session idle...');
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
      }

      // 3. Draining
      if (prevId) {
        this.registry.updateHealth(prevId, { state: AccountState.Draining });
        this.runtime.drainingAccountId = prevId;
      }

      // 4. Checkpoint Ledger
      await this.ledger.checkpoint({
        objective: 'Resuming work after rotation',
        repoPath: process.cwd(),
        branch: 'main',
        activeAccountId: decision.selectedId,
        previousAccountId: prevId,
        lastUserIntent: 'Continue development loop',
        lastCommand: 'npm run dev',
        filesTouched: [],
        lastPatchResult: 'success',
        lastError: null,
        switchReason: decision.reason,
        nextStep: 'Verify environment stability',
        resumePayload: {},
      });

      // 5. Auth Switch
      const nextAcc = this.registry.getAccount(decision.selectedId);
      if (!nextAcc) throw new Error('Selected account missing');
      await this.adapter.switchAuth(nextAcc.sourcePath);

      // 6. Verification
      const verified = await this.adapter.verifyIdentity(decision.selectedId);
      if (!verified) {
        throw new Error(`Identity verification failed. Expected ${decision.selectedId}`);
      }

      // 7. Reload Session
      await this.adapter.reloadSession();

      // 8. Dispatch Resume Action
      logger.log('Dispatching resume signal using ledger context');
      // In a real env, this would call a Codex API or signal the editor
      await new Promise(r => setTimeout(r, 500)); 

      // 9. Active update
      this.runtime.activeAccountId = decision.selectedId;
      this.registry.updateHealth(decision.selectedId, { state: AccountState.Active });

      // 10. Cleanup prev
      if (prevId) {
        const cooldownMinutes = decision.isHard 
          ? this.config.cooldownDurationMinutes 
          : this.config.rateLimitCooldownMinutes;
        
        const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
        
        this.registry.updateHealth(prevId, { 
          state: AccountState.CoolingDown, 
          cooldownUntil,
        });
        this.runtime.drainingAccountId = null;
      }

      this.runtime.lastSwitchAt = new Date().toISOString();
      this.runtime.sessionStatus = 'idle';
      
      logger.log('Switch successful', { id: decision.selectedId });
      await this.registry.save();
    } catch (error) {
      this.runtime.sessionStatus = 'idle';
      logger.error('Switch sequence aborted', error);
      // Attempt rollback health state if possible
      if (prevId) {
        this.registry.updateHealth(prevId, { state: AccountState.Active });
      }
      throw error;
    }
  }
}
