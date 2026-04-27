import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import {
  AppSettingsV2,
  ProfileRecord,
  ProfileUsageSnapshot,
  RecommendationStatus,
  SnapshotStatus,
  SwitchEvent,
  SwitchEventType,
  VerificationStatus,
  LimitStatus,
  ProfilePlan,
} from './types';

const SCHEMA_VERSION = 2;

export interface DurableState {
  schemaVersion: number;
  profiles: ProfileRecord[];
  usageSnapshots: ProfileUsageSnapshot[];
  switchEvents: SwitchEvent[];
  settings: AppSettingsV2;
  profileSnapshotMetadata: Record<string, { snapshotPath: string | null; snapshotStatus: SnapshotStatus; updatedAt: string }>;
}

export class DurableStore {
  private state: DurableState;
  private readonly filePath: string;
  private readonly backupPath: string;

  constructor(private baseDir: string) {
    this.filePath = path.join(baseDir, 'durable-state.json');
    this.backupPath = path.join(baseDir, 'durable-state.backup.json');
    this.state = this.defaultState();
  }

  private defaultState(): DurableState {
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: [],
      usageSnapshots: [],
      switchEvents: [],
      settings: {
        schemaVersion: SCHEMA_VERSION,
        activeProfileId: null,
        demoMode: false,
      },
      profileSnapshotMetadata: {},
    };
  }

  async load() {
    await fs.mkdir(this.baseDir, { recursive: true });
    const loaded = await this.readStateWithRecovery();
    this.state = loaded ?? this.defaultState();
    if (this.state.schemaVersion !== SCHEMA_VERSION) {
      this.migrate(this.state);
      await this.save();
    }
  }

  private migrate(state: DurableState) {
    state.schemaVersion = SCHEMA_VERSION;
    state.settings.schemaVersion = SCHEMA_VERSION;
  }

  private async readStateWithRecovery(): Promise<DurableState | null> {
    const fromPrimary = await this.tryRead(this.filePath);
    if (fromPrimary) return fromPrimary;
    return this.tryRead(this.backupPath);
  }

  private async tryRead(p: string): Promise<DurableState | null> {
    try {
      const raw = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(raw) as DurableState;
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.profiles)) return null;
      if (!Array.isArray(parsed.usageSnapshots)) return null;
      if (!Array.isArray(parsed.switchEvents)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  getState(): DurableState {
    return structuredClone(this.state);
  }

  async save() {
    const tmpPath = `${this.filePath}.tmp`;
    const payload = JSON.stringify(this.state, null, 2);

    try {
      await fs.copyFile(this.filePath, this.backupPath);
    } catch {
      // First write: no backup yet.
    }

    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(payload, 'utf-8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    await fs.rename(tmpPath, this.filePath);
  }

  async createProfile(input: { alias: string; plan: ProfilePlan; priority: number; snapshotPath?: string | null; notes?: string | null }) {
    const now = new Date().toISOString();
    const id = `profile_${crypto.randomUUID()}`;
    const planMultiplier = {
      [ProfilePlan.Plus]: 1,
      [ProfilePlan.Pro100]: 5,
      [ProfilePlan.Pro200]: 20,
      [ProfilePlan.Unknown]: 0,
    }[input.plan];

    const profile: ProfileRecord = {
      id,
      alias: input.alias,
      plan: input.plan,
      capacityMultiplier: planMultiplier,
      priority: input.priority,
      snapshotPath: input.snapshotPath ?? null,
      snapshotStatus: input.snapshotPath ? SnapshotStatus.Captured : SnapshotStatus.Unknown,
      createdAt: now,
      updatedAt: now,
      lastActivatedAt: null,
      lastVerifiedAt: null,
      verificationStatus: VerificationStatus.Unknown,
      fiveHourStatus: LimitStatus.Unknown,
      weeklyStatus: LimitStatus.Unknown,
      creditsStatus: LimitStatus.Unknown,
      observedResetAt: null,
      lastLimitBanner: null,
      notes: input.notes ?? null,
      recommendation: RecommendationStatus.Unknown,
      recommendationReason: 'No recommendation computed yet',
    };

    this.state.profiles.push(profile);
    this.state.profileSnapshotMetadata[id] = {
      snapshotPath: profile.snapshotPath,
      snapshotStatus: profile.snapshotStatus,
      updatedAt: now,
    };

    this.appendEvent({
      eventType: SwitchEventType.PROFILE_CREATED,
      profileId: id,
      targetProfileId: null,
      severity: 'info',
      message: `Profile created: ${profile.alias}`,
      metadata: { plan: profile.plan, priority: profile.priority },
    });

    await this.save();
    return profile;
  }

  async updateProfile(id: string, updates: Partial<ProfileRecord>) {
    const idx = this.state.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const current = this.state.profiles[idx];
    const updated: ProfileRecord = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.state.profiles[idx] = updated;
    this.state.profileSnapshotMetadata[id] = {
      snapshotPath: updated.snapshotPath,
      snapshotStatus: updated.snapshotStatus,
      updatedAt: updated.updatedAt,
    };

    this.appendEvent({
      eventType: SwitchEventType.PROFILE_UPDATED,
      profileId: id,
      targetProfileId: null,
      severity: 'info',
      message: `Profile updated: ${updated.alias}`,
      metadata: { updates },
    });

    await this.save();
    return updated;
  }

  async addUsageSnapshot(profileId: string, payload: Omit<ProfileUsageSnapshot, 'id' | 'profileId' | 'createdAt'>) {
    const profile = this.state.profiles.find((p) => p.id === profileId);
    if (!profile) return null;

    const snapshot: ProfileUsageSnapshot = {
      id: `usage_${crypto.randomUUID()}`,
      profileId,
      createdAt: new Date().toISOString(),
      ...payload,
    };

    this.state.usageSnapshots.push(snapshot);

    profile.fiveHourStatus = snapshot.fiveHourStatus;
    profile.weeklyStatus = snapshot.weeklyStatus;
    profile.creditsStatus = snapshot.creditsStatus;
    profile.observedResetAt = snapshot.observedResetAt;
    profile.lastLimitBanner = snapshot.lastLimitBanner;
    profile.notes = snapshot.notes;
    profile.updatedAt = new Date().toISOString();

    this.appendEvent({
      eventType: SwitchEventType.USAGE_SNAPSHOT_UPDATED,
      profileId,
      targetProfileId: null,
      severity: 'info',
      message: 'Usage snapshot updated',
      metadata: { source: snapshot.source },
    });

    await this.save();
    return snapshot;
  }

  listUsageSnapshots(profileId: string) {
    return this.state.usageSnapshots.filter((s) => s.profileId === profileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getProfile(id: string) {
    return this.state.profiles.find((p) => p.id === id) ?? null;
  }

  listProfiles() {
    return [...this.state.profiles].sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  }

  getLedger(limit = 200) {
    return this.state.switchEvents.slice(-limit).reverse();
  }

  appendEvent(event: Omit<SwitchEvent, 'id' | 'timestamp'>) {
    const full: SwitchEvent = {
      id: `evt_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.state.switchEvents.push(full);
    if (this.state.switchEvents.length > 5000) {
      this.state.switchEvents = this.state.switchEvents.slice(-5000);
    }
    return full;
  }

  async setActiveProfile(profileId: string | null) {
    this.state.settings.activeProfileId = profileId;
    if (profileId) {
      const profile = this.state.profiles.find((p) => p.id === profileId);
      if (profile) {
        profile.lastActivatedAt = new Date().toISOString();
        profile.updatedAt = new Date().toISOString();
      }
    }
    await this.save();
  }

  getSettings() {
    return structuredClone(this.state.settings);
  }

  async patchSettings(updates: Partial<AppSettingsV2>) {
    this.state.settings = {
      ...this.state.settings,
      ...updates,
      schemaVersion: SCHEMA_VERSION,
    };
    await this.save();
    return this.getSettings();
  }
}
