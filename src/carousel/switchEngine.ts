import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { DurableStore } from './durableStore';
import { ProfilePlan, SnapshotStatus, SwitchEventType, VerificationStatus } from './types';
import { normalizeCodexLaunchCommand } from './launchCommand';

const STALE_LOCK_MS = 5 * 60 * 1000;

export type SwitchEngineOptions = {
  fixtureRootDir?: string | null;
  reason?: string;
};

export type RealSwitchOptions = {
  confirm: boolean;
  fixtureRootDir?: string | null;
};

export type CaptureCurrentOptions = {
  alias: string;
  plan: ProfilePlan;
};

export type SwitchStatus = {
  locked: boolean;
  lockPath: string;
  lock: SwitchLockRecord | null;
  stale: boolean;
};

export type SwitchLockRecord = {
  id: string;
  createdAt: string;
  pid: number;
  targetProfileId: string;
  mode: 'dry-run' | 'real-switch';
};

export type SwitchPlanItem = {
  path: string;
  exists: boolean;
  safeForLogs: boolean;
  source: 'profileSnapshotPath' | 'fixtureRootDir' | 'codexProfileRootPath' | 'unknown';
};

export type DryRunResult = {
  dryRun: true;
  sourceActiveProfileId: string | null;
  targetProfileId: string;
  verification: {
    activeProfile: string;
    targetProfile: string;
    cloudValidation: string[];
    windowsLocalValidationRequired: string[];
  };
  backupPlan: SwitchPlanItem[];
  restorePlan: SwitchPlanItem[];
  rollbackPlan: SwitchPlanItem[];
  warnings: string[];
  designDoc: string;
};

export class SwitchEngine {
  private lockPath: string;
  private snapshotsRoot: string;
  private rollbacksRoot: string;

  constructor(private store: DurableStore, private stateDir: string) {
    this.lockPath = path.join(stateDir, 'switch.lock.json');
    this.snapshotsRoot = path.join(stateDir, 'profile-snapshots');
    this.rollbacksRoot = path.join(stateDir, 'rollbacks');
  }

  async captureCurrentProfile(options: CaptureCurrentOptions) {
    this.ensureLocalSwitchingEnabled();
    const profileRoot = await this.resolveProfileRoot();

    await this.assertCodexProcessSafe();

    const sourceEntries = await this.listCodexSourceEntries(profileRoot);
    if (sourceEntries.length === 0 || !(await this.hasLikelyLoginData(profileRoot))) {
      throw new Error('No Codex profile files discovered under configured codexProfileRootPath');
    }

    const created = await this.store.createProfile({
      alias: options.alias,
      plan: options.plan,
      priority: 1,
      snapshotPath: null,
      notes: 'Captured from local Codex profile root',
    });

    await this.writeLedgerEvents(SwitchEventType.PROFILE_CAPTURE_REQUESTED, {
      profileId: created.id,
      targetProfileId: null,
      severity: 'info',
      message: 'Profile capture started',
      metadata: { alias: created.alias, phase: 5 },
    });

    const snapshotDir = path.join(this.snapshotsRoot, created.id);
    await fs.mkdir(snapshotDir, { recursive: true });

    const checksums = await this.copyTreeWithChecksums(profileRoot, snapshotDir);
    const manifestPath = path.join(snapshotDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), checksums }, null, 2), 'utf-8');

    await this.store.updateProfile(created.id, {
      snapshotPath: snapshotDir,
      snapshotStatus: SnapshotStatus.Captured,
      verificationStatus: VerificationStatus.Unverified,
    });
    await this.store.upsertSnapshotMetadata(created.id, {
      snapshotPath: snapshotDir,
      snapshotStatus: SnapshotStatus.Captured,
      fileCount: checksums.length,
      manifestPath,
      checksums,
    });

    await this.writeLedgerEvents(SwitchEventType.PROFILE_CAPTURE_COMPLETED, {
      profileId: created.id,
      targetProfileId: null,
      severity: 'info',
      message: 'Profile capture completed',
      metadata: { fileCount: checksums.length, manifestPath },
    });

    return {
      profile: this.store.getProfile(created.id),
      capture: {
        snapshotPath: snapshotDir,
        manifestPath,
        fileCount: checksums.length,
      },
    };
  }

  async preflightSwitch(targetProfileId: string, options: SwitchEngineOptions = {}) {
    const [targetValidation, activeValidation, status] = await Promise.all([
      this.validateTargetProfile(targetProfileId),
      this.validateActiveProfile(),
      this.getSwitchStatus(),
    ]);

    const warnings: string[] = [];
    if (!targetValidation.ok) warnings.push(targetValidation.message);
    if (!activeValidation.ok) warnings.push(activeValidation.message);
    if (status.locked) warnings.push(status.stale ? 'Switch lock exists and appears stale' : 'Switch lock exists and is active');

    if (!this.store.getSettings().localSwitchingEnabled) warnings.push('Local switching is disabled in settings');
    if (!this.isSwitchEnvironmentAllowed(options.fixtureRootDir ?? null)) warnings.push('Real switching requires Windows host unless fixture mode is explicitly enabled for tests');

    const profileRoot = this.store.getSettings().codexProfileRootPath;
    if (!profileRoot) warnings.push('codexProfileRootPath is not configured');
    if (profileRoot && !(await this.fileExists(profileRoot))) warnings.push('Configured codexProfileRootPath does not exist');

    const writable = await this.store.storageWritable();
    if (!writable) warnings.push('Backend storage is not writable');

    const target = this.store.getProfile(targetProfileId);
    if (!target?.snapshotPath) warnings.push('Target profile has no captured snapshotPath');
    if (target?.snapshotPath && !(await this.fileExists(target.snapshotPath))) warnings.push('Target snapshotPath does not exist on disk');

    try {
      await this.assertCodexProcessSafe();
    } catch (error) {
      warnings.push(String(error));
    }

    return {
      ok: warnings.length === 0,
      warnings,
      targetValidation,
      activeValidation,
      switchStatus: status,
    };
  }

  async dryRunSwitch(targetProfileId: string, options: SwitchEngineOptions = {}): Promise<DryRunResult> {
    await this.writeLedgerEvents(SwitchEventType.SWITCH_DRY_RUN_STARTED, {
      profileId: this.store.getSettings().activeProfileId,
      targetProfileId,
      severity: 'info',
      message: 'Switch dry-run started',
      metadata: { phase: 5, dryRun: true },
    });

    let lock: SwitchLockRecord | null = null;
    try {
      const preflight = await this.preflightSwitch(targetProfileId, options);
      if (!preflight.targetValidation.ok) throw new Error(preflight.targetValidation.message);

      lock = await this.acquireSwitchLock(targetProfileId, 'dry-run');

      const backupPlan = await this.planBackup(targetProfileId, options);
      const restorePlan = await this.planRestore(targetProfileId, options);
      const rollbackPlan = await this.planRollback(targetProfileId, options);

      const result: DryRunResult = {
        dryRun: true,
        sourceActiveProfileId: this.store.getSettings().activeProfileId,
        targetProfileId,
        verification: {
          activeProfile: preflight.activeValidation.message,
          targetProfile: preflight.targetValidation.message,
          cloudValidation: ['Target profile exists in durable backend store', 'Switch lock + storage checks available'],
          windowsLocalValidationRequired: ['Confirm Codex local profile file mapping', 'Manually verify signed-in identity after switch'],
        },
        backupPlan,
        restorePlan,
        rollbackPlan,
        warnings: preflight.warnings,
        designDoc: 'docs/WINDOWS_CODEX_PROFILE_SWITCHING_DESIGN.md',
      };

      await this.writeLedgerEvents(SwitchEventType.SWITCH_DRY_RUN_COMPLETED, {
        profileId: this.store.getSettings().activeProfileId,
        targetProfileId,
        severity: 'info',
        message: 'Switch dry-run completed',
        metadata: { phase: 5, dryRun: true },
      });

      return result;
    } catch (error) {
      await this.writeLedgerEvents(SwitchEventType.SWITCH_DRY_RUN_FAILED, {
        profileId: this.store.getSettings().activeProfileId,
        targetProfileId,
        severity: 'error',
        message: `Switch dry-run failed: ${String(error)}`,
        metadata: { phase: 5, dryRun: true },
      });
      throw error;
    } finally {
      if (lock) await this.releaseSwitchLock(lock.id);
    }
  }

  async executeSwitch(targetProfileId: string, options: RealSwitchOptions) {
    if (!options.confirm) throw new Error('Explicit confirmation is required for real switch');
    this.ensureLocalSwitchingEnabled();

    const preflight = await this.preflightSwitch(targetProfileId, { fixtureRootDir: options.fixtureRootDir ?? null });
    if (!preflight.ok) throw new Error(`Preflight failed: ${preflight.warnings.join('; ')}`);

    const dryRun = await this.dryRunSwitch(targetProfileId, { fixtureRootDir: options.fixtureRootDir ?? null });
    if (dryRun.warnings.length > 0) {
      throw new Error(`Dry-run produced warnings: ${dryRun.warnings.join('; ')}`);
    }

    const previousActive = this.store.getSettings().activeProfileId;
    const target = this.store.getProfile(targetProfileId);
    if (!target?.snapshotPath) throw new Error('Target profile has no snapshotPath');

    const lock = await this.acquireSwitchLock(targetProfileId, 'real-switch');

    let rollbackDir: string | null = null;
    try {
      await this.writeLedgerEvents(SwitchEventType.SWITCH_STARTED, {
        profileId: previousActive,
        targetProfileId,
        severity: 'info',
        message: 'Real switch started',
        metadata: { phase: 5 },
      });

      const profileRoot = await this.resolveProfileRoot();
      rollbackDir = path.join(this.rollbacksRoot, `rb_${Date.now()}`);
      await fs.mkdir(rollbackDir, { recursive: true });
      const rollbackChecksums = await this.copyTreeWithChecksums(profileRoot, rollbackDir);
      await this.writeLedgerEvents(SwitchEventType.ACTIVE_PROFILE_BACKED_UP, {
        profileId: previousActive,
        targetProfileId,
        severity: 'info',
        message: 'Active profile backed up for rollback',
        metadata: { rollbackDir, fileCount: rollbackChecksums.length },
      });

      if (process.env.CAROUSEL_TEST_FAIL_AFTER_BACKUP === 'true') {
        throw new Error('Injected failure after backup for rollback test');
      }

      await this.clearDirectoryContents(profileRoot);
      await this.copyTree(target.snapshotPath, profileRoot);
      const restoredChecksums = await this.computeChecksums(profileRoot);
      await this.writeLedgerEvents(SwitchEventType.TARGET_PROFILE_RESTORED, {
        profileId: previousActive,
        targetProfileId,
        severity: 'info',
        message: 'Target snapshot restored into Codex profile root',
        metadata: { fileCount: restoredChecksums.length },
      });

      await this.writeLedgerEvents(SwitchEventType.VERIFY_UNAVAILABLE, {
        profileId: previousActive,
        targetProfileId,
        severity: 'warning',
        message: 'Local profile restored, identity not verified',
        metadata: { reason: 'No safe Codex identity verification command available in this environment' },
      });
      await this.store.updateProfile(targetProfileId, { verificationStatus: VerificationStatus.VerifyUnavailable });

      await this.store.setActiveProfile(targetProfileId);
      await this.writeLedgerEvents(SwitchEventType.SWITCH_COMPLETED, {
        profileId: previousActive,
        targetProfileId,
        severity: 'info',
        message: 'Real switch completed',
        metadata: { verification: 'unavailable' },
      });

      if (this.store.getSettings().autoLaunchAfterSwitch) {
        await this.launchCodex();
      }

      return {
        success: true,
        activeProfileId: targetProfileId,
        rollbackDir,
        verification: 'Local profile restored, identity not verified',
      };
    } catch (error) {
      await this.writeLedgerEvents(SwitchEventType.SWITCH_FAILED, {
        profileId: previousActive,
        targetProfileId,
        severity: 'error',
        message: `Real switch failed: ${String(error)}`,
        metadata: { rollbackAttempted: !!rollbackDir },
      });

      if (rollbackDir) {
        await this.writeLedgerEvents(SwitchEventType.ROLLBACK_STARTED, {
          profileId: previousActive,
          targetProfileId,
          severity: 'warning',
          message: 'Rollback started after switch failure',
          metadata: { rollbackDir },
        });
        try {
          const profileRoot = await this.resolveProfileRoot();
          await this.clearDirectoryContents(profileRoot);
          await this.copyTree(rollbackDir, profileRoot);
          await this.writeLedgerEvents(SwitchEventType.ROLLBACK_COMPLETED, {
            profileId: previousActive,
            targetProfileId,
            severity: 'info',
            message: 'Rollback completed successfully',
            metadata: { rollbackDir },
          });
        } catch (rollbackError) {
          await this.writeLedgerEvents(SwitchEventType.ROLLBACK_FAILED, {
            profileId: previousActive,
            targetProfileId,
            severity: 'error',
            message: `Rollback failed: ${String(rollbackError)}`,
            metadata: { rollbackDir },
          });
        }
      }

      throw error;
    } finally {
      await this.releaseSwitchLock(lock.id);
    }
  }

  async launchCodex(commandOverride?: string | null) {
    const command = normalizeCodexLaunchCommand(commandOverride ?? this.store.getSettings().codexLaunchCommand);
    if (!command) throw new Error('codexLaunchCommand is not configured');

    await this.writeLedgerEvents(SwitchEventType.CODEX_LAUNCH_REQUESTED, {
      profileId: this.store.getSettings().activeProfileId,
      targetProfileId: null,
      severity: 'info',
      message: 'Codex launch requested',
      metadata: { command },
    });

    const launched = await new Promise<boolean>((resolve) => {
      const child = spawn(command, { shell: true, detached: true, stdio: 'ignore' });
      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    });

    if (!launched) throw new Error(`Failed to launch Codex with command: ${command}`);
    return { launched: true, command };
  }

  async acquireSwitchLock(targetProfileId: string, mode: SwitchLockRecord['mode'] = 'dry-run'): Promise<SwitchLockRecord> {
    const status = await this.getSwitchStatus();
    if (status.locked) throw new Error(status.stale ? 'Switch lock exists and is stale; clear it explicitly before retry' : 'Switch lock already held');

    const lock: SwitchLockRecord = {
      id: `lock_${Date.now()}`,
      createdAt: new Date().toISOString(),
      pid: process.pid,
      targetProfileId,
      mode,
    };

    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.lockPath, JSON.stringify(lock, null, 2), { encoding: 'utf-8', flag: 'wx' });
    return lock;
  }

  async releaseSwitchLock(lockId?: string) {
    const lock = await this.readLock();
    if (!lock) return;
    if (lockId && lock.id !== lockId) throw new Error('Cannot release lock with mismatched lock id');
    await fs.rm(this.lockPath, { force: true });
  }

  async clearSwitchLockIfSafe(confirm: boolean) {
    if (!confirm) throw new Error('Explicit confirmation is required to clear switch lock');
    const status = await this.getSwitchStatus();
    if (!status.locked) return { cleared: false, reason: 'No lock exists' };
    if (!status.stale) return { cleared: false, reason: 'Lock is not stale; refusing clear' };
    await fs.rm(this.lockPath, { force: true });
    return { cleared: true, reason: 'Stale lock cleared' };
  }

  async getSwitchStatus(): Promise<SwitchStatus> {
    const lock = await this.readLock();
    const stale = !!lock && (Date.now() - Date.parse(lock.createdAt) > STALE_LOCK_MS);
    return { locked: !!lock, lockPath: this.lockPath, lock, stale };
  }

  async validateTargetProfile(targetProfileId: string) {
    const profile = this.store.getProfile(targetProfileId);
    if (!profile) return { ok: false, message: `Target profile ${targetProfileId} does not exist` };
    if (!profile.snapshotPath) return { ok: false, message: `Target profile ${targetProfileId} has no snapshotPath` };
    return { ok: true, message: `Target profile ${targetProfileId} is present (${profile.alias})` };
  }

  async validateActiveProfile() {
    const activeProfileId = this.store.getSettings().activeProfileId;
    if (!activeProfileId) return { ok: true, message: 'No active profile is currently selected' };
    const active = this.store.getProfile(activeProfileId);
    if (!active) return { ok: false, message: `Active profile pointer ${activeProfileId} is invalid` };
    return { ok: true, message: `Active profile ${activeProfileId} is present (${active.alias})` };
  }

  async planBackup(targetProfileId: string, options: SwitchEngineOptions = {}): Promise<SwitchPlanItem[]> {
    const profileRoot = this.store.getSettings().codexProfileRootPath;
    const items: SwitchPlanItem[] = [];
    if (profileRoot) items.push(await this.planItem(profileRoot, 'codexProfileRootPath'));
    if (options.fixtureRootDir) items.push(await this.planItem(path.join(options.fixtureRootDir, targetProfileId, 'active-session-fixture.json'), 'fixtureRootDir'));
    if (items.length === 0) items.push({ path: 'unknown', exists: false, safeForLogs: true, source: 'unknown' });
    return items;
  }

  async planRestore(targetProfileId: string, options: SwitchEngineOptions = {}): Promise<SwitchPlanItem[]> {
    const targetProfile = this.store.getProfile(targetProfileId);
    const items: SwitchPlanItem[] = [];
    if (targetProfile?.snapshotPath) items.push(await this.planItem(targetProfile.snapshotPath, 'profileSnapshotPath'));
    if (options.fixtureRootDir) items.push(await this.planItem(path.join(options.fixtureRootDir, targetProfileId, 'target-session-fixture.json'), 'fixtureRootDir'));
    if (items.length === 0) items.push({ path: 'unknown', exists: false, safeForLogs: true, source: 'unknown' });
    return items;
  }

  async planRollback(targetProfileId: string, options: SwitchEngineOptions = {}): Promise<SwitchPlanItem[]> {
    return this.planBackup(targetProfileId, options);
  }

  async writeLedgerEvents(eventType: SwitchEventType, payload: {
    profileId: string | null;
    targetProfileId: string | null;
    severity: 'info' | 'warning' | 'error';
    message: string;
    metadata: Record<string, any>;
  }) {
    const cleanMetadata = this.redactMetadata(payload.metadata ?? {});
    this.store.appendEvent({ eventType, ...payload, metadata: cleanMetadata });
    await this.store.save();
  }

  async getDoctorLockIssue(): Promise<string | null> {
    const status = await this.getSwitchStatus();
    if (!status.locked) return null;
    return status.stale ? `Stale switch lock detected at ${status.lockPath}` : 'Switch lock is active';
  }

  async getDoctorLaunchIssue(): Promise<string | null> {
    if (!this.store.getSettings().localSwitchingEnabled) return null;
    if (!this.store.getSettings().codexLaunchCommand) return 'codexLaunchCommand is not configured';
    return null;
  }

  async assertCodexProcessSafe() {
    const settings = this.store.getSettings();
    const processes = await this.listCodexProcesses();
    if (processes.length === 0) return;
    if (settings.requireCodexClosedBeforeSwitch) {
      if (settings.allowProcessStop) {
        throw new Error('Codex appears to be running and process-stop automation is not implemented by default. Close Codex manually and retry.');
      }
      throw new Error('Codex appears to be running. Close Codex manually before capture/switch.');
    }
  }

  async listCodexProcesses(): Promise<string[]> {
    const override = process.env.CAROUSEL_TEST_RUNNING_PROCESSES;
    if (override) {
      return override.split(',').map((s) => s.trim()).filter((s) => /codex/i.test(s));
    }

    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        const child = spawn('tasklist', ['/fo', 'csv', '/nh']);
        let out = '';
        child.stdout.on('data', (d) => (out += d.toString()));
        child.on('close', () => {
          const lines = out.split(/\r?\n/).filter(Boolean);
          const names = lines.map((line) => line.split(',')[0]?.replaceAll('"', '')).filter(Boolean) as string[];
          resolve(names.filter((name) => /codex/i.test(name)));
        });
        child.on('error', () => resolve([]));
      });
    }

    return [];
  }

  async getCodexProcessStatus() {
    const processes = await this.listCodexProcesses();
    return { running: processes.length > 0, processes };
  }

  private ensureLocalSwitchingEnabled() {
    if (!this.store.getSettings().localSwitchingEnabled) {
      throw new Error('Local switching is disabled. Enable settings.localSwitchingEnabled first.');
    }
  }

  private isSwitchEnvironmentAllowed(fixtureRootDir: string | null) {
    if (process.platform === 'win32') return true;
    return Boolean(fixtureRootDir && fixtureRootDir.includes('fixture') && process.env.CAROUSEL_ALLOW_NON_WINDOWS_SWITCH_FOR_TESTS === 'true');
  }

  private async resolveProfileRoot() {
    const root = this.store.getSettings().codexProfileRootPath;
    if (!root) throw new Error('codexProfileRootPath is not configured');
    if (!(await this.fileExists(root))) throw new Error('Configured codexProfileRootPath does not exist');
    return root;
  }

  private redactMetadata(metadata: Record<string, any>) {
    if (!this.store.getSettings().redactSensitivePathsInLogs) return metadata;
    const clone: Record<string, any> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (typeof v === 'string' && (k.toLowerCase().includes('token') || k.toLowerCase().includes('secret'))) {
        clone[k] = '[REDACTED]';
      } else if (typeof v === 'string' && k.toLowerCase().includes('path')) {
        clone[k] = this.redactPath(v);
      } else {
        clone[k] = v;
      }
    }
    return clone;
  }

  private redactPath(input: string) {
    const base = path.basename(input);
    return `.../${base}`;
  }

  private async readLock(): Promise<SwitchLockRecord | null> {
    try {
      const raw = await fs.readFile(this.lockPath, 'utf-8');
      return JSON.parse(raw) as SwitchLockRecord;
    } catch {
      return null;
    }
  }

  private async planItem(filePath: string, source: SwitchPlanItem['source']): Promise<SwitchPlanItem> {
    return { path: filePath, exists: await this.fileExists(filePath), safeForLogs: true, source };
  }

  private async fileExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async listCodexSourceEntries(root: string) {
    const files: string[] = [];
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (entry.isFile()) files.push(full);
      }
    };
    await walk(root);
    return files;
  }

  private async hasLikelyLoginData(root: string) {
    const names = (await this.listCodexSourceEntries(root)).map((file) => path.basename(file).toLowerCase());
    return names.some((name) => /(auth|session|login|config|state)/i.test(name));
  }

  private async copyTreeWithChecksums(srcDir: string, destDir: string) {
    await this.copyTree(srcDir, destDir);
    return this.computeChecksums(destDir);
  }

  private async copyTree(srcDir: string, destDir: string) {
    await fs.mkdir(destDir, { recursive: true });
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const src = path.join(srcDir, entry.name);
      const dst = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await this.copyTree(src, dst);
      } else if (entry.isFile()) {
        await fs.copyFile(src, dst);
      }
    }
  }

  private async clearDirectoryContents(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map((entry) => fs.rm(path.join(dir, entry.name), { recursive: true, force: true })));
  }

  private async computeChecksums(root: string) {
    const files: Array<{ relativePath: string; sha256: string; size: number }> = [];

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!entry.isFile()) continue;
        const buffer = await fs.readFile(full);
        files.push({
          relativePath: path.relative(root, full),
          sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
          size: buffer.length,
        });
      }
    };

    await walk(root);
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return files;
  }
}

export const SWITCH_ENGINE_STALE_LOCK_MS = STALE_LOCK_MS;
