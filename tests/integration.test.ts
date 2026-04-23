/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Storage } from '../src/carousel/storage';
import { Registry } from '../src/carousel/registry';
import { Arbiter } from '../src/carousel/arbiter';
import { Ledger } from '../src/carousel/ledger';
import { RuntimeStore } from '../src/carousel/runtime';
import { Bridge, DevTestAdapter } from '../src/carousel/bridge';
import { loadConfig } from '../src/carousel/config';
import { AccountState, SwitchReason, FailureKind } from '../src/carousel/types';
import { StateMachine } from '../src/carousel/stateMachine';
import { logger } from '../src/carousel/logging';
import * as fs from 'fs/promises';
import * as path from 'path';

// Create isolated test directory
const TEST_DIR = `/tmp/carousel-test-${Date.now()}`;

describe('Integration Tests', () => {
  let config: ReturnType<typeof loadConfig>;
  let storage: Storage;
  let registry: Registry;
  let arbiter: Arbiter;
  let ledger: Ledger;
  let runtimeStore: RuntimeStore;
  let bridge: Bridge;

  beforeEach(async () => {
    // Setup fresh test environment
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    config = loadConfig({
      stateDir: TEST_DIR,
      logDir: path.join(TEST_DIR, 'logs'),
      inboxDir: path.join(TEST_DIR, 'inbox'),
      accountsDir: path.join(TEST_DIR, 'accounts'),
      cooldownDurationMinutes: 5,
      uiRefreshIntervalMs: 1000,
    });

    storage = new Storage(config.stateDir);
    await storage.ensureDir();
    await storage.ensureDir('ledgers');
    await storage.ensureDir('ledgers/history');

    registry = new Registry(storage, config);
    arbiter = new Arbiter(config);
    ledger = new Ledger(storage);
    runtimeStore = new RuntimeStore(storage);
    bridge = new Bridge(registry, arbiter, ledger, runtimeStore, config, new DevTestAdapter());
    
    await registry.load();
    await ledger.load();
    await runtimeStore.load();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('Registry Import and Deduplication', () => {
    it('should import a new account', async () => {
      const acc = await registry.importAccount({
        alias: 'Test Account',
        priority: 5,
        sourcePath: '/test/auth.json',
        disabled: false,
        metadata: {}
      });

      expect(acc.id).toBe('test-account');
      expect(acc.alias).toBe('Test Account');
      expect(acc.priority).toBe(5);
      
      const allAccounts = registry.getAllAccounts();
      expect(allAccounts.length).toBe(1);
    });

    it('should deduplicate by fingerprint', async () => {
      const acc1 = await registry.importAccount({
        alias: 'First Name',
        priority: 3,
        sourcePath: '/same/path.json',
        disabled: false,
        metadata: {}
      });

      const acc2 = await registry.importAccount({
        alias: 'Second Name',
        priority: 7,
        sourcePath: '/same/path.json', // Same source = same fingerprint
        disabled: false,
        metadata: {}
      });

      // Should be the same account (deduplicated)
      expect(acc2.id).toBe(acc1.id);
      expect(acc2.alias).toBe('First Name'); // First one kept
      
      const allAccounts = registry.getAllAccounts();
      expect(allAccounts.length).toBe(1);
    });

    it('should persist and reload registry', async () => {
      await registry.importAccount({
        alias: 'Persist Test',
        priority: 2,
        sourcePath: '/persist.json',
        disabled: false,
        metadata: {}
      });

      // Create new registry instance and load
      const newRegistry = new Registry(storage, config);
      await newRegistry.load();

      const accounts = newRegistry.getAllAccounts();
      expect(accounts.length).toBe(1);
      expect(accounts[0].alias).toBe('Persist Test');
    });
  });

  describe('Health and State Transitions', () => {
    it('should create default health record on import', async () => {
      const acc = await registry.importAccount({
        alias: 'Health Test',
        priority: 1,
        sourcePath: '/health.json',
        disabled: false,
        metadata: {}
      });

      const health = registry.getHealth(acc.id);
      expect(health).toBeDefined();
      expect(health?.state).toBe(AccountState.Available);
      expect(health?.consecutiveFailures).toBe(0);
    });

    it('should update health state', async () => {
      const acc = await registry.importAccount({
        alias: 'State Update Test',
        priority: 1,
        sourcePath: '/state.json',
        disabled: false,
        metadata: {}
      });

      registry.updateHealth(acc.id, { state: AccountState.Active });
      const health = registry.getHealth(acc.id);
      expect(health?.state).toBe(AccountState.Active);
    });

    it('should record failures', async () => {
      const acc = await registry.importAccount({
        alias: 'Failure Test',
        priority: 1,
        sourcePath: '/fail.json',
        disabled: false,
        metadata: {}
      });

      await registry.recordFailure(acc.id, FailureKind.QuotaExhausted);
      await registry.recordFailure(acc.id, FailureKind.RateLimited);

      const health = registry.getHealth(acc.id);
      expect(health?.consecutiveFailures).toBe(2);
      expect(health?.lastFailureKind).toBe(FailureKind.RateLimited);
    });

    it('should reset failures on success', async () => {
      const acc = await registry.importAccount({
        alias: 'Success Test',
        priority: 1,
        sourcePath: '/success.json',
        disabled: false,
        metadata: {}
      });

      await registry.recordFailure(acc.id, FailureKind.Unknown);
      await registry.recordSuccess(acc.id);

      const health = registry.getHealth(acc.id);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.lastFailureKind).toBe(null);
    });
  });

  describe('Arbiter Selection', () => {
    it('should select highest priority available account', async () => {
      const acc1 = await registry.importAccount({ alias: 'Low Priority', priority: 1, sourcePath: '/p1.json', disabled: false, metadata: {} });
      const acc2 = await registry.importAccount({ alias: 'High Priority', priority: 10, sourcePath: '/p2.json', disabled: false, metadata: {} });
      const acc3 = await registry.importAccount({ alias: 'Medium Priority', priority: 5, sourcePath: '/p3.json', disabled: false, metadata: {} });

      const decision = arbiter.selectNext(
        registry.getAllAccounts(),
        registry.getHealthMap(),
        null
      );

      expect(decision.selectedId).toBe(acc2.id);
    });

    it('should exclude active account', async () => {
      const acc1 = await registry.importAccount({ alias: 'Active Acc', priority: 10, sourcePath: '/a1.json', disabled: false, metadata: {} });
      const acc2 = await registry.importAccount({ alias: 'Standby Acc', priority: 5, sourcePath: '/a2.json', disabled: false, metadata: {} });

      registry.updateHealth(acc1.id, { state: AccountState.Active });

      const decision = arbiter.selectNext(
        registry.getAllAccounts(),
        registry.getHealthMap(),
        acc1.id
      );

      expect(decision.selectedId).not.toBe(acc1.id);
      expect(decision.selectedId).toBe(acc2.id);
    });

    it('should exclude cooling down accounts', async () => {
      const acc1 = await registry.importAccount({ alias: 'Cooling Acc', priority: 10, sourcePath: '/c1.json', disabled: false, metadata: {} });
      const acc2 = await registry.importAccount({ alias: 'Available Acc', priority: 5, sourcePath: '/c2.json', disabled: false, metadata: {} });

      const cooldownUntil = new Date(Date.now() + 60000).toISOString(); // 1 minute in future
      registry.updateHealth(acc1.id, { state: AccountState.CoolingDown, cooldownUntil });

      const decision = arbiter.selectNext(
        registry.getAllAccounts(),
        registry.getHealthMap(),
        null
      );

      expect(decision.selectedId).not.toBe(acc1.id);
    });

    it('should apply fair rotation penalty', async () => {
      const acc1 = await registry.importAccount({ alias: 'Used Acc', priority: 5, sourcePath: '/f1.json', disabled: false, metadata: {} });
      const acc2 = await registry.importAccount({ alias: 'Fresh Acc', priority: 5, sourcePath: '/f2.json', disabled: false, metadata: {} });

      registry.updateHealth(acc1.id, { selectionCount: 10 });

      const decision = arbiter.selectNext(
        registry.getAllAccounts(),
        registry.getHealthMap(),
        null
      );

      expect(decision.selectedId).toBe(acc2.id);
    });
  });

  describe('Ledger Checkpoint and Restore', () => {
    it('should save and load checkpoint', async () => {
      const acc = await registry.importAccount({ alias: 'Ledger Test', priority: 1, sourcePath: '/l1.json', disabled: false, metadata: {} });

      await ledger.checkpoint({
        objective: 'Test objective',
        repoPath: '/test/repo',
        branch: 'main',
        activeAccountId: acc.id,
        previousAccountId: null,
        lastUserIntent: 'Testing',
        lastCommand: 'npm test',
        filesTouched: ['file1.ts'],
        lastPatchResult: 'success',
        lastError: null,
        switchReason: SwitchReason.UserManuallySwitched,
        nextStep: 'Continue testing',
        resumePayload: { testData: 'value' }
      });

      const current = ledger.getCurrent();
      expect(current).toBeDefined();
      expect(current?.activeAccountId).toBe(acc.id);
      expect(current?.objective).toBe('Test objective');
    });

    it('should persist checkpoint to disk', async () => {
      const acc = await registry.importAccount({ alias: 'Persist Ledger', priority: 1, sourcePath: '/pl1.json', disabled: false, metadata: {} });

      await ledger.checkpoint({
        objective: 'Persist test',
        repoPath: '/persist',
        branch: 'main',
        activeAccountId: acc.id,
        previousAccountId: null,
        lastUserIntent: 'Test',
        lastCommand: 'test',
        filesTouched: [],
        lastPatchResult: 'ok',
        lastError: null,
        switchReason: SwitchReason.QuotaPressure,
        nextStep: 'Resume',
        resumePayload: {}
      });

      // Load fresh ledger
      const newLedger = new Ledger(storage);
      await newLedger.load();

      const loaded = newLedger.getCurrent();
      expect(loaded?.activeAccountId).toBe(acc.id);
    });
  });

  describe('Runtime Persistence', () => {
    it('should persist and restore runtime state', async () => {
      const acc = await registry.importAccount({ alias: 'Runtime Test', priority: 1, sourcePath: '/r1.json', disabled: false, metadata: {} });

      runtimeStore.setActiveAccount(acc.id);
      runtimeStore.setSessionStatus('idle');
      await runtimeStore.save();

      // Load fresh runtime store
      const newRuntime = new RuntimeStore(storage);
      await newRuntime.load();

      const state = newRuntime.getState();
      expect(state.activeAccountId).toBe(acc.id);
    });

    it('should handle restart recovery', async () => {
      const acc = await registry.importAccount({ alias: 'Recovery Test', priority: 1, sourcePath: '/rec1.json', disabled: false, metadata: {} });
      registry.updateHealth(acc.id, { state: AccountState.Active });
      await registry.save();

      runtimeStore.setActiveAccount(acc.id);
      runtimeStore.setSessionStatus('switching');
      await runtimeStore.save();

      // Simulate restart
      const newRuntime = new RuntimeStore(storage);
      await newRuntime.load();
      await newRuntime.onRestart();

      const state = newRuntime.getState();
      expect(state.activeAccountId).toBe(acc.id);
      expect(state.sessionStatus).toBe('idle'); // Reset from switching
    });
  });

  describe('Bridge Switch Flow', () => {
    it('should perform successful switch', async () => {
      const acc1 = await registry.importAccount({ alias: 'Account One', priority: 10, sourcePath: '/sw1.json', disabled: false, metadata: {} });
      const acc2 = await registry.importAccount({ alias: 'Account Two', priority: 5, sourcePath: '/sw2.json', disabled: false, metadata: {} });

      // Set acc1 as active
      registry.updateHealth(acc1.id, { state: AccountState.Active });
      runtimeStore.setActiveAccount(acc1.id);
      await registry.save();
      await runtimeStore.save();

      const result = await bridge.performSwitch(SwitchReason.UserManuallySwitched);

      expect(result.success).toBe(true);
      expect(result.selectedId).toBe(acc2.id);

      // Verify states updated
      const health1 = registry.getHealth(acc1.id);
      const health2 = registry.getHealth(acc2.id);
      
      expect(health1?.state).toBe(AccountState.CoolingDown);
      expect(health2?.state).toBe(AccountState.Active);
    });

    it('should reject switch when already switching', async () => {
      const acc = await registry.importAccount({ alias: 'Single Acc', priority: 1, sourcePath: '/single.json', disabled: false, metadata: {} });
      
      runtimeStore.setSessionStatus('switching');

      const result = await bridge.performSwitch(SwitchReason.UserManuallySwitched);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });

    it('should fail when no eligible accounts', async () => {
      const acc = await registry.importAccount({ alias: 'Only Acc', priority: 1, sourcePath: '/only.json', disabled: false, metadata: {} });
      
      registry.updateHealth(acc.id, { state: AccountState.Active });
      runtimeStore.setActiveAccount(acc.id);

      const result = await bridge.performSwitch(SwitchReason.UserManuallySwitched);

      expect(result.success).toBe(false);
    });
  });

  describe('State Machine Transitions', () => {
    it('should allow valid transitions', () => {
      expect(StateMachine.canTransition(AccountState.Available, AccountState.Active)).toBe(true);
      expect(StateMachine.canTransition(AccountState.Active, AccountState.Draining)).toBe(true);
      expect(StateMachine.canTransition(AccountState.Draining, AccountState.CoolingDown)).toBe(true);
      expect(StateMachine.canTransition(AccountState.CoolingDown, AccountState.Recovering)).toBe(true);
      expect(StateMachine.canTransition(AccountState.Recovering, AccountState.Available)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(StateMachine.canTransition(AccountState.Active, AccountState.Available)).toBe(false);
      expect(StateMachine.canTransition(AccountState.Available, AccountState.Draining)).toBe(false);
      expect(StateMachine.canTransition(AccountState.Draining, AccountState.Active)).toBe(false);
    });
  });

  describe('Monitor Cooldown and Recovery', () => {
    it('should detect expired cooldown', async () => {
      const acc = await registry.importAccount({ alias: 'Cooldown Test', priority: 1, sourcePath: '/cd1.json', disabled: false, metadata: {} });
      
      const expiredTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      registry.updateHealth(acc.id, { state: AccountState.CoolingDown, cooldownUntil: expiredTime });

      // Tick monitor
      const switchRequests: SwitchReason[] = [];
      const monitor = new (await import('../src/carousel/monitor')).Monitor(
        registry,
        config,
        (reason) => switchRequests.push(reason)
      );

      // Manually trigger tick to check cooldown
      await (monitor as any).tick();

      const health = registry.getHealth(acc.id);
      expect(health?.state).toBe(AccountState.Recovering);
    });
  });
});
