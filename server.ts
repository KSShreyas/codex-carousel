/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './src/carousel/config';
import { logger } from './src/carousel/logging';
import { DurableStore } from './src/carousel/durableStore';
import { persistRecommendations, recomputeRecommendations } from './src/carousel/recommendations';
import { LimitStatus, ProfilePlan, SnapshotStatus, SwitchEventType, UsageSnapshotSource, VerificationStatus } from './src/carousel/types';
import { SwitchEngine } from './src/carousel/switchEngine';

function parsePlan(input: any): ProfilePlan {
  return Object.values(ProfilePlan).includes(input) ? input : ProfilePlan.Unknown;
}

function parseLimit(input: any): LimitStatus {
  return Object.values(LimitStatus).includes(input) ? input : LimitStatus.Unknown;
}

function parseUsageSource(input: any): UsageSnapshotSource {
  return Object.values(UsageSnapshotSource).includes(input) ? input : UsageSnapshotSource.Unknown;
}

function parseBoolean(input: any, fallback: boolean): boolean {
  if (typeof input === 'boolean') return input;
  return fallback;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  const config = loadConfig();
  logger.setLogFile(path.join(config.logDir, 'carousel.jsonl'));
  await logger.init();

  const store = new DurableStore(config.stateDir);
  await store.load();
  await store.patchSettings({ demoMode: config.demoMode });
  const switchEngine = new SwitchEngine(store, config.stateDir);

  // Demo mode seeding is explicit and disabled by default.
  if (config.demoMode && store.getState().profiles.length === 0) {
    await store.createProfile({ alias: 'Demo Codex Profile', plan: ProfilePlan.Unknown, priority: 1, snapshotPath: '/demo/profile.json', notes: 'Demo mode seeded profile' });
  }

  const apiStatus = async () => {
    const state = store.getState();
    const activeProfile = state.settings.activeProfileId ? state.profiles.find((p) => p.id === state.settings.activeProfileId) ?? null : null;
    const recommendations = recomputeRecommendations(store);
    const switchStatus = await switchEngine.getSwitchStatus();
    return {
      runtime: {
        activeProfileId: state.settings.activeProfileId,
      },
      switchStatus,
      activeProfile,
      profiles: state.profiles,
      recommendations,
      settings: state.settings,
      ledger: state.switchEvents.slice(-100).reverse(),
    };
  };

  const appVersion = async () => {
    try {
      const pkgRaw = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8');
      return (JSON.parse(pkgRaw) as { version?: string }).version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  };

  app.get('/api/status', async (_req, res) => {
    res.json(await apiStatus());
  });

  app.get('/api/health', async (_req, res) => {
    const state = store.getState();
    const storageWritable = await store.storageWritable();
    const ledgerWritable = storageWritable;
    res.json({
      ok: storageWritable,
      version: await appVersion(),
      storageStatus: storageWritable ? 'ok' : 'error',
      demoMode: state.settings.demoMode,
      activeProfileId: state.settings.activeProfileId,
      ledgerWritable,
      profileCount: state.profiles.length,
      lastEventTimestamp: store.getLastEventTimestamp(),
    });
  });

  app.get('/api/profiles', (_req, res) => {
    res.json(store.listProfiles());
  });

  app.get('/api/profiles/:id', (req, res) => {
    const profile = store.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  });

  app.post('/api/profiles', async (req, res) => {
    const { alias, plan, priority, snapshotPath, notes } = req.body;
    if (!alias) return res.status(400).json({ error: 'alias is required' });

    const created = await store.createProfile({
      alias,
      plan: parsePlan(plan),
      priority: Number.isFinite(priority) ? Number(priority) : 1,
      snapshotPath: snapshotPath ?? null,
      notes: notes ?? null,
    });

    if (store.getSettings().activeProfileId === null) {
      await store.setActiveProfile(created.id);
      store.appendEvent({
        eventType: SwitchEventType.SWITCH_COMPLETED,
        profileId: created.id,
        targetProfileId: null,
        severity: 'info',
        message: 'Initial active profile selected',
        metadata: {},
      });
      await store.save();
    }

    res.status(201).json(created);
  });

  app.patch('/api/profiles/:id', async (req, res) => {
    const patch = { ...req.body };
    if (patch.plan) patch.plan = parsePlan(patch.plan);
    if (patch.fiveHourStatus) patch.fiveHourStatus = parseLimit(patch.fiveHourStatus);
    if (patch.weeklyStatus) patch.weeklyStatus = parseLimit(patch.weeklyStatus);
    if (patch.creditsStatus) patch.creditsStatus = parseLimit(patch.creditsStatus);
    if (patch.snapshotStatus && !Object.values(SnapshotStatus).includes(patch.snapshotStatus)) patch.snapshotStatus = SnapshotStatus.Unknown;
    if (patch.verificationStatus && !Object.values(VerificationStatus).includes(patch.verificationStatus)) patch.verificationStatus = VerificationStatus.Unknown;

    const updated = await store.updateProfile(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'Profile not found' });
    res.json(updated);
  });

  app.post('/api/profiles/:id/usage-snapshots', async (req, res) => {
    const snapshot = await store.addUsageSnapshot(req.params.id, {
      fiveHourStatus: parseLimit(req.body.fiveHourStatus),
      weeklyStatus: parseLimit(req.body.weeklyStatus),
      creditsStatus: parseLimit(req.body.creditsStatus),
      observedResetAt: req.body.observedResetAt ?? null,
      lastLimitBanner: req.body.lastLimitBanner ?? null,
      notes: req.body.notes ?? null,
      source: parseUsageSource(req.body.source),
    });

    if (!snapshot) return res.status(404).json({ error: 'Profile not found' });
    res.status(201).json(snapshot);
  });

  app.get('/api/profiles/:id/usage-snapshots', (req, res) => {
    res.json(store.listUsageSnapshots(req.params.id));
  });

  app.get('/api/ledger', (req, res) => {
    const limit = Number(req.query.limit ?? 200);
    res.json(store.getLedger(limit));
  });

  app.get('/api/recommendations', (_req, res) => {
    res.json(recomputeRecommendations(store));
  });

  app.post('/api/recommendations/recompute', async (_req, res) => {
    const result = await persistRecommendations(store);
    res.json(result);
  });

  app.get('/api/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  app.patch('/api/settings', async (req, res) => {
    const current = store.getSettings();
    const payload = {
      ...req.body,
      localSwitchingEnabled: parseBoolean(req.body?.localSwitchingEnabled, current.localSwitchingEnabled),
      requireCodexClosedBeforeSwitch: parseBoolean(req.body?.requireCodexClosedBeforeSwitch, current.requireCodexClosedBeforeSwitch),
      allowProcessStop: parseBoolean(req.body?.allowProcessStop, current.allowProcessStop),
      autoLaunchAfterSwitch: parseBoolean(req.body?.autoLaunchAfterSwitch, current.autoLaunchAfterSwitch),
      redactSensitivePathsInLogs: parseBoolean(req.body?.redactSensitivePathsInLogs, current.redactSensitivePathsInLogs),
    };
    const patched = await store.patchSettings(payload);
    res.json(patched);
  });

  app.get('/api/doctor', (_req, res) => {
    (async () => {
      const state = store.getState();
      const issues: string[] = [];

      // storage exists
      try {
        await fs.access(store.getStorageFilePath());
      } catch {
        issues.push('Storage file does not exist');
      }

      // storage writable and ledger writable
      const writable = await store.storageWritable();
      if (!writable) issues.push('Storage is not writable');
      if (!writable) issues.push('Ledger is not writable');

      // demo mode status + no normal-mode demo accounts
      if (!state.settings.demoMode) {
        const seededDemo = state.profiles.filter((p) => p.alias.toLowerCase().includes('demo'));
        if (seededDemo.length > 0) {
          issues.push('Demo-like profiles exist while demo mode is disabled');
        }
      }

      // active pointer valid
      if (state.settings.activeProfileId && !state.profiles.some((p) => p.id === state.settings.activeProfileId)) {
        issues.push('Active profile pointer is invalid');
      }

      // snapshot paths exist if captured
      for (const profile of state.profiles) {
        if (profile.snapshotStatus === SnapshotStatus.Captured && profile.snapshotPath) {
          try {
            await fs.access(profile.snapshotPath);
          } catch {
            issues.push(`Captured snapshot path missing for profile ${profile.id}`);
          }
        }
      }

      // no switch lock stuck / unfinished switch op
      const ledger = state.switchEvents;
      const latestStart = [...ledger].reverse().find((e) => e.eventType === SwitchEventType.SWITCH_STARTED);
      const latestCompletion = [...ledger].reverse().find((e) =>
        [SwitchEventType.SWITCH_COMPLETED, SwitchEventType.SWITCH_FAILED, SwitchEventType.ROLLBACK_COMPLETED, SwitchEventType.ROLLBACK_FAILED].includes(e.eventType)
      );
      if (latestStart && (!latestCompletion || latestCompletion.timestamp < latestStart.timestamp)) {
        issues.push('Unfinished switch operation detected without recovery status');
      }

      const lockIssue = await switchEngine.getDoctorLockIssue();
      if (lockIssue) issues.push(lockIssue);

      const launchIssue = await switchEngine.getDoctorLaunchIssue();
      if (launchIssue) issues.push(launchIssue);

      res.json({
        status: issues.length === 0 ? 'healthy' : 'degraded',
        issues,
        profileCount: state.profiles.length,
        demoMode: state.settings.demoMode,
      });
    })().catch((err) => {
      res.status(500).json({ status: 'error', error: String(err) });
    });
  });

  // Backward-compatible account aliases
  app.get('/api/accounts', (_req, res) => res.json(store.listProfiles()));
  app.post('/api/accounts/import', async (req, res) => {
    const created = await store.createProfile({
      alias: req.body.alias,
      plan: parsePlan(req.body.plan),
      priority: Number.isFinite(req.body.priority) ? Number(req.body.priority) : 1,
      snapshotPath: req.body.sourcePath ?? null,
    });
    store.appendEvent({
      eventType: SwitchEventType.PROFILE_CAPTURE_COMPLETED,
      profileId: created.id,
      targetProfileId: null,
      severity: 'info',
      message: 'Legacy import mapped to profile creation',
      metadata: {},
    });
    await store.save();
    res.status(201).json(created);
  });



  app.post('/api/profiles/capture-current', async (req, res) => {
    const alias = req.body?.alias;
    const plan = parsePlan(req.body?.plan);
    if (!alias) return res.status(400).json({ error: 'alias is required' });

    try {
      const result = await switchEngine.captureCurrentProfile({ alias, plan });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.post('/api/codex/launch', async (_req, res) => {
    try {
      const result = await switchEngine.launchCodex();
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.post('/api/profiles/:id/switch/dry-run', async (req, res) => {
    const targetProfileId = req.params.id;
    const options = {
      fixtureRootDir: req.body?.fixtureRootDir ?? null,
      reason: req.body?.reason ?? 'manual-dry-run',
    };

    if (options.fixtureRootDir && !String(options.fixtureRootDir).includes('fixture')) {
      return res.status(400).json({ error: 'fixtureRootDir is only allowed for explicit test fixture directories' });
    }

    try {
      const result = await switchEngine.dryRunSwitch(targetProfileId, options);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get('/api/switch/status', async (_req, res) => {
    const status = await switchEngine.getSwitchStatus();
    res.json(status);
  });

  app.post('/api/switch/lock/clear', async (req, res) => {
    const confirm = Boolean(req.body?.confirm);
    try {
      const result = await switchEngine.clearSwitchLockIfSafe(confirm);
      if (!result.cleared) {
        return res.status(409).json({ error: result.reason, ...result });
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.post('/api/profiles/:id/switch', async (req, res) => {
    const targetProfileId = req.params.id;
    const profile = store.getProfile(targetProfileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const confirm = req.body?.confirm === true;
    const fixtureRootDir = req.body?.fixtureRootDir ?? null;

    try {
      const result = await switchEngine.executeSwitch(targetProfileId, { confirm, fixtureRootDir });
      res.json(result);
    } catch (error) {
      const message = String(error);
      const status = /confirm/i.test(message) ? 400 : 409;
      res.status(status).json({ error: message, phase: 5 });
    }
  });

  // Backward-compatible switch endpoint for CLI interoperability.
  app.post('/api/switch', async (req, res) => {
    const targetProfileId = req.body?.targetProfileId;
    if (!targetProfileId) return res.status(400).json({ error: 'targetProfileId is required' });
    const profile = store.getProfile(targetProfileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const confirm = req.body?.confirm === true;
    const fixtureRootDir = req.body?.fixtureRootDir ?? null;
    try {
      const result = await switchEngine.executeSwitch(targetProfileId, { confirm, fixtureRootDir });
      res.json(result);
    } catch (error) {
      res.status(409).json({ error: String(error), phase: 5 });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const host = process.env.CAROUSEL_BIND_HOST || '127.0.0.1';
  app.listen(PORT, host, () => {
    console.log(`Codex Carousel Server running on http://${host}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Critical server failure:', err);
  process.exit(1);
});
