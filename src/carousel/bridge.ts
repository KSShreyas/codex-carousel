/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountId, AccountState, SwitchReason, AppConfig, RuntimeState } from './types';
import { Registry } from './registry';
import { Arbiter } from './arbiter';
import { Ledger } from './ledger';
import { logger } from './logging';
import { StateMachine } from './stateMachine';
import { RuntimeStore } from './runtime';

/**
 * Bridge Adapter Interface
 * Production implementations must implement all methods.
 * Dev/Test implementations may use deterministic mocks.
 */
export interface IBridgeAdapter {
  /** Execute profile switch outside this service (future phase) */
  switchAuth(nextPath: string): Promise<void>;
}

/**
 * Development/Test Adapter
 * Uses deterministic mocks for testing and development.
 * NOT suitable for production use.
 */
export class DevTestAdapter implements IBridgeAdapter {
  async switchAuth(nextPath: string): Promise<void> {
    logger.log('DevAdapter: no-op switchAuth invoked', { path: nextPath });
  }
}

/**
 * Production Adapter Stub
 * This is a placeholder for real Codex integration.
 * In production, this would integrate with actual Codex auth system.
 * 
 * TODO: Implement real production adapters when live integration is available:
 * - Real idle detection via editor/process monitoring
 * - Real auth file switching via secure credential manager
 * - Real identity verification via Codex API
 * - Real session reload via Codex client
 * - Real resume dispatch via Codex command interface
 */
export class ProductionAdapterStub implements IBridgeAdapter {
  constructor() {
    logger.log('ProductionAdapterStub initialized - DEV MODE ONLY');
    logger.log('WARN: Production adapter not implemented - using stub');
  }

  async switchAuth(nextPath: string): Promise<void> {
    // STUB: In production, this would securely switch auth credentials
    throw new Error('Production adapter not implemented.');
  }
}

export class Bridge {
  private adapter: IBridgeAdapter;

  constructor(
    private registry: Registry,
    private arbiter: Arbiter,
    private ledger: Ledger,
    private runtimeStore: RuntimeStore,
    private config: AppConfig,
    adapter?: IBridgeAdapter
  ) {
    // Use provided adapter or default to DevTestAdapter for development
    // Production deployments must explicitly provide a production adapter
    this.adapter = adapter ?? new DevTestAdapter();
    logger.log('Bridge initialized', { adapterType: adapter?.constructor.name ?? 'DevTestAdapter' });
  }

  setAdapter(adapter: IBridgeAdapter) {
    this.adapter = adapter;
    logger.log('Bridge adapter changed', { adapterType: adapter.constructor.name });
  }

  getRuntime(): RuntimeState {
    return this.runtimeStore.getState();
  }

  async initialize() {
    await this.registry.load();
    await this.ledger.load();
    await this.runtimeStore.load();
    
    // Recovery from crash: find active account from health store
    const accounts = this.registry.getAllAccounts();
    const active = accounts.find(a => {
      const health = this.registry.getHealth(a.id);
      return health?.state === AccountState.Active;
    });
    
    if (active) {
      this.runtimeStore.setActiveAccount(active.id);
      logger.log('Restart recovery: found active account', { id: active.id });
    }
    
    // Handle interrupted switch state
    await this.runtimeStore.onRestart();
    
    await this.runtimeStore.save();
  }

  async performSwitch(reason: SwitchReason): Promise<{ success: boolean; selectedId?: string; error?: string }> {
    const runtime = this.runtimeStore.getState();
    
    if (runtime.sessionStatus === 'switching') {
      logger.log('Switch already in progress, ignoring request');
      return { success: false, error: 'Switch already in progress' };
    }

    this.runtimeStore.setSessionStatus('switching');
    const prevId = runtime.activeAccountId;
    
    try {
      // 1. Selection using arbiter
      const decision = this.arbiter.selectNext(
        this.registry.getAllAccounts(), 
        this.registry.getHealthMap(),
        prevId
      );

      logger.log('Profile switch sequence started', { from: prevId, to: decision.selectedId, reason });

      // 3. Mark current account as Draining
      if (prevId) {
        this.registry.updateHealth(prevId, { state: AccountState.Draining });
        this.runtimeStore.setDrainingAccount(prevId);
      }

      // 4. Checkpoint Ledger BEFORE switch
      const checkpoint = {
        objective: 'Resume after manual profile switch',
        repoPath: process.cwd(),
        branch: 'main',
        activeAccountId: decision.selectedId,
        previousAccountId: prevId,
        lastUserIntent: 'Manual profile switch requested',
        lastCommand: 'carousel switch',
        filesTouched: [],
        lastPatchResult: 'success',
        lastError: null,
        switchReason: reason,
        nextStep: 'Verify environment stability',
        resumePayload: {},
      };
      await this.ledger.checkpoint(checkpoint);
      logger.log('Ledger checkpointed before profile switch', { checkpointId: checkpoint.activeAccountId });

      // 5. Auth Switch
      const nextAcc = this.registry.getAccount(decision.selectedId);
      if (!nextAcc) {
        throw new Error('Selected account not found in registry');
      }
      // Phase 1 scope lock: do not perform fake identity verification or fake resume dispatch.
      // Real profile file switching is intentionally deferred to later phases with safety gates.
      await this.adapter.switchAuth(nextAcc.sourcePath);

      // 9. Update Active account
      this.runtimeStore.setPreviousAccount(prevId);
      this.runtimeStore.setActiveAccount(decision.selectedId);
      this.registry.updateHealth(decision.selectedId, { 
        state: AccountState.Active,
        lastSwitchInAt: new Date().toISOString(),
      });

      // 10. Move previous account to CoolingDown
      if (prevId) {
        const cooldownMinutes = decision.isHard 
          ? this.config.cooldownDurationMinutes 
          : this.config.rateLimitCooldownMinutes;
        
        const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
        
        this.registry.updateHealth(prevId, { 
          state: AccountState.CoolingDown, 
          cooldownUntil,
          lastSwitchOutAt: new Date().toISOString(),
        });
        this.runtimeStore.setDrainingAccount(null);
      }

      this.runtimeStore.setLastSwitchAt(new Date().toISOString());
      this.runtimeStore.setSessionStatus('idle');
      
      logger.log('Profile switch recorded', { id: decision.selectedId });
      await this.registry.save();
      await this.runtimeStore.save();
      
      return { success: true, selectedId: decision.selectedId };
    } catch (error) {
      this.runtimeStore.setSessionStatus('idle');
      logger.error('Profile switch sequence failed', error);
      
      // Attempt rollback: restore previous account to Active if it was draining
      if (prevId) {
        this.registry.updateHealth(prevId, { state: AccountState.Active });
        this.runtimeStore.setDrainingAccount(null);
      }
      
      await this.registry.save();
      await this.runtimeStore.save();
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}
