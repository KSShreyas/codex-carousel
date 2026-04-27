/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './src/carousel/config';
import { logger } from './src/carousel/logging';
import { DurableStore } from './src/carousel/durableStore';
import { persistRecommendations, recomputeRecommendations } from './src/carousel/recommendations';
import { LimitStatus, ProfilePlan, SnapshotStatus, SwitchEventType, UsageSnapshotSource, VerificationStatus } from './src/carousel/types';

function parsePlan(input: any): ProfilePlan {
  return Object.values(ProfilePlan).includes(input) ? input : ProfilePlan.Unknown;
}

function parseLimit(input: any): LimitStatus {
  return Object.values(LimitStatus).includes(input) ? input : LimitStatus.Unknown;
}

function parseUsageSource(input: any): UsageSnapshotSource {
  return Object.values(UsageSnapshotSource).includes(input) ? input : UsageSnapshotSource.Unknown;
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

  // Demo mode seeding is explicit and disabled by default.
  if (config.demoMode && store.getState().profiles.length === 0) {
    await store.createProfile({ alias: 'Demo Codex Profile', plan: ProfilePlan.Unknown, priority: 1, snapshotPath: '/demo/profile.json', notes: 'Demo mode seeded profile' });
  }

  const apiStatus = async () => {
    const state = store.getState();
    const activeProfile = state.settings.activeProfileId ? state.profiles.find((p) => p.id === state.settings.activeProfileId) ?? null : null;
    const recommendations = recomputeRecommendations(store);
    return {
      runtime: {
        activeProfileId: state.settings.activeProfileId,
      },
      activeProfile,
      profiles: state.profiles,
      recommendations,
      settings: state.settings,
      ledger: state.switchEvents.slice(-100).reverse(),
    };
  };

  app.get('/api/status', async (_req, res) => {
    res.json(await apiStatus());
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
    const patched = await store.patchSettings(req.body);
    res.json(patched);
  });

  app.get('/api/doctor', (_req, res) => {
    const state = store.getState();
    const issues: string[] = [];
    if (!state.settings.activeProfileId && state.profiles.length > 0) {
      issues.push('Active profile pointer is not set');
    }
    if (state.schemaVersion !== 2) {
      issues.push('Schema version mismatch');
    }
    res.json({ status: issues.length === 0 ? 'healthy' : 'degraded', issues, profileCount: state.profiles.length });
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

  // Manual-only switch: pointer update + ledger event only.
  app.post('/api/switch', async (req, res) => {
    const { targetProfileId } = req.body;
    const target = targetProfileId ? store.getProfile(targetProfileId) : null;
    if (!target) return res.status(400).json({ error: 'targetProfileId is required and must exist' });

    const current = store.getSettings().activeProfileId;
    store.appendEvent({
      eventType: SwitchEventType.SWITCH_STARTED,
      profileId: current,
      targetProfileId,
      severity: 'info',
      message: 'Manual switch started (pointer update only)',
      metadata: { phase: 2, realFileSwitching: false },
    });
    await store.setActiveProfile(targetProfileId);
    store.appendEvent({
      eventType: SwitchEventType.SWITCH_COMPLETED,
      profileId: current,
      targetProfileId,
      severity: 'info',
      message: 'Manual switch completed (pointer update only)',
      metadata: { phase: 2, realFileSwitching: false },
    });
    await store.save();
    res.json({ success: true, activeProfileId: targetProfileId });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Codex Carousel Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Critical server failure:', err);
  process.exit(1);
});
