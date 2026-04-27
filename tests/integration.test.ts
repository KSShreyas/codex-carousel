import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { DurableStore } from '../src/carousel/durableStore';
import { LimitStatus, ProfilePlan, SnapshotStatus, UsageSnapshotSource, VerificationStatus } from '../src/carousel/types';
import { recomputeRecommendations } from '../src/carousel/recommendations';

const TEST_DIR = `/tmp/codex-carousel-phase2-${Date.now()}`;

describe('Phase 2 durable profile store', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  it('profile creation persists after restart', async () => {
    const store = new DurableStore(TEST_DIR);
    await store.load();
    const created = await store.createProfile({ alias: 'Primary', plan: ProfilePlan.Plus, priority: 1, snapshotPath: '/snap/a.json' });

    const restarted = new DurableStore(TEST_DIR);
    await restarted.load();
    expect(restarted.getProfile(created.id)?.alias).toBe('Primary');
  });

  it('usage snapshot persists after restart', async () => {
    const store = new DurableStore(TEST_DIR);
    await store.load();
    const profile = await store.createProfile({ alias: 'Usage Profile', plan: ProfilePlan.Unknown, priority: 1, snapshotPath: '/snap/u.json' });

    await store.addUsageSnapshot(profile.id, {
      fiveHourStatus: LimitStatus.Low,
      weeklyStatus: LimitStatus.Available,
      creditsStatus: LimitStatus.Unknown,
      observedResetAt: null,
      lastLimitBanner: '5h limit warning',
      notes: 'manual note',
      source: UsageSnapshotSource.Manual,
    });

    const restarted = new DurableStore(TEST_DIR);
    await restarted.load();
    const snapshots = restarted.listUsageSnapshots(profile.id);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].fiveHourStatus).toBe(LimitStatus.Low);
  });

  it('ledger persists after restart', async () => {
    const store = new DurableStore(TEST_DIR);
    await store.load();
    const profile = await store.createProfile({ alias: 'Ledger Profile', plan: ProfilePlan.Plus, priority: 1, snapshotPath: '/snap/l.json' });
    const events = store.getLedger();
    expect(events.some((e) => e.profileId === profile.id)).toBe(true);

    const restarted = new DurableStore(TEST_DIR);
    await restarted.load();
    expect(restarted.getLedger().length).toBeGreaterThan(0);
  });

  it('unknown usage remains unknown recommendation', async () => {
    const store = new DurableStore(TEST_DIR);
    await store.load();
    const profile = await store.createProfile({ alias: 'Unknown Usage', plan: ProfilePlan.Plus, priority: 1, snapshotPath: '/snap/unknown.json' });
    await store.setActiveProfile(profile.id);
    await store.updateProfile(profile.id, {
      fiveHourStatus: LimitStatus.Unknown,
      weeklyStatus: LimitStatus.Unknown,
      verificationStatus: VerificationStatus.Verified,
    });

    const recommendations = recomputeRecommendations(store);
    const item = recommendations.profiles.find((p) => p.id === profile.id)!;
    expect(item.recommendation).toBe('Unknown');
    expect(item.recommendationReason?.toLowerCase()).toContain('unknown');
  });

  it('exhausted active profile yields SwitchNow recommendation only', async () => {
    const store = new DurableStore(TEST_DIR);
    await store.load();

    const active = await store.createProfile({ alias: 'Exhausted Active', plan: ProfilePlan.Plus, priority: 1, snapshotPath: '/snap/active.json' });
    const target = await store.createProfile({ alias: 'Target', plan: ProfilePlan.Pro100, priority: 1, snapshotPath: '/snap/target.json' });

    await store.setActiveProfile(active.id);
    await store.updateProfile(active.id, {
      fiveHourStatus: LimitStatus.Exhausted,
      weeklyStatus: LimitStatus.Exhausted,
      verificationStatus: VerificationStatus.Verified,
    });
    await store.updateProfile(target.id, {
      fiveHourStatus: LimitStatus.Available,
      weeklyStatus: LimitStatus.Available,
      snapshotStatus: SnapshotStatus.Captured,
      verificationStatus: VerificationStatus.Verified,
    });

    const before = store.getSettings().activeProfileId;
    const recommendations = recomputeRecommendations(store);
    const activeReco = recommendations.profiles.find((p) => p.id === active.id)!;

    expect(activeReco.recommendation).toBe('SwitchNow');
    expect(store.getSettings().activeProfileId).toBe(before);
  });
});
