/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountId = string;
export type AccountAlias = string;
export type AccountFingerprint = string;
export type AccountSourcePath = string;

export enum AccountState {
  Available = 'Available',
  Active = 'Active',
  Draining = 'Draining',
  CoolingDown = 'CoolingDown',
  Recovering = 'Recovering',
  Suspended = 'Suspended',
  Disabled = 'Disabled',
}

export enum FailureKind {
  QuotaExhausted = 'QuotaExhausted',
  RateLimited = 'RateLimited',
  AuthFailed = 'AuthFailed',
  NetworkError = 'NetworkError',
  Unknown = 'Unknown',
}

export enum SwitchReason {
  UserManuallySwitched = 'UserManuallySwitched',
  QuotaPressure = 'QuotaPressure',
  HardExhaustion = 'HardExhaustion',
  HealthCheckFailed = 'HealthCheckFailed',
  CoolingRotation = 'CoolingRotation',
}

export interface UsageSnapshot {
  five_hour_remaining: number;
  five_hour_total: number;
  weekly_remaining: number;
  weekly_total: number;
  timestamp: string;
  confidence: UsageConfidence;
}

export enum UsageConfidence {
  Unknown = 'Unknown',
  Observed = 'Observed',
  Verified = 'Verified',
  SimulatedDemo = 'Simulated/Demo',
}

export interface AccountRegistryRecord {
  id: AccountId;
  alias: AccountAlias;
  fingerprint: AccountFingerprint;
  sourcePath: AccountSourcePath;
  priority: number;
  disabled: boolean;
  metadata: Record<string, any>;
}

export interface AccountHealthRecord {
  id: AccountId;
  state: AccountState;
  usage: UsageSnapshot | null;
  lastRefreshAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureKind: FailureKind | null;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  recentUseAt: string | null;
  selectionCount: number;
  lastSwitchInAt: string | null;
  lastSwitchOutAt: string | null;
  recoveryAttempts: number;
  suspendedReason: string | null;
}

export interface RuntimeState {
  activeAccountId: AccountId | null;
  drainingAccountId: AccountId | null;
  previousAccountId: AccountId | null;
  uptimeStart: string;
  lastSwitchAt: string | null;
  sessionStatus: 'idle' | 'busy' | 'switching';
  pendingSwitch?: PendingSwitchRequest;
}

export interface PendingSwitchRequest {
  fromAccountId: AccountId | null;
  toAccountId: AccountId;
  reason: SwitchReason;
  requestedAt: string;
}

export interface LedgerCheckpoint {
  id: string;
  timestamp: string;
  objective: string;
  repoPath: string;
  branch: string;
  activeAccountId: AccountId;
  previousAccountId: AccountId | null;
  lastUserIntent: string;
  lastCommand: string;
  filesTouched: string[];
  lastPatchResult: string;
  lastError: string | null;
  switchReason: SwitchReason | null;
  nextStep: string;
  resumePayload: any;
}

export interface RecoveryStatus {
  accountId: AccountId;
  probedAt: string;
  success: boolean;
  error?: string;
}

export interface PolicyConfig {
  stickyPrimary: boolean;
  fiveHourThreshold: number;
  weeklyThreshold: number;
  cooldownDurationMinutes: number;
  rateLimitCooldownMinutes: number;
  recoveryProbeIntervalMinutes: number;
  maxConsecutiveFailures: number;
  fairRotation: boolean;
  recentUsePenalty: number;
  failurePenalty: number;
}

export interface AppConfig {
  stateDir: string;
  logDir: string;
  inboxDir: string;
  accountsDir: string;
  stickyPrimary: boolean;
  fiveHourThreshold: number;
  weeklyThreshold: number;
  cooldownDurationMinutes: number;
  rateLimitCooldownMinutes: number;
  authFailureCooldownMinutes: number;
  recoveryProbeIntervalMinutes: number;
  maxConsecutiveFailures: number;
  fairRotation: boolean;
  recentUsePenalty: number;
  failurePenalty: number;
  uiRefreshIntervalMs: number;
  bridgeReloadTimeoutMs: number;
  ledgerRetentionCount: number;
  demoMode: boolean;
}

export interface SelectionDecision {
  selectedId: AccountId;
  reason: SwitchReason;
  isHard: boolean;
  scores: Record<AccountId, number>;
  breakdown: string;
}

export interface BridgeEvent {
  type: 'switch_request' | 'switch_success' | 'switch_failure' | 'checkpoint' | 'resume_attempt' | 'resume_success' | 'resume_failure';
  accountId: AccountId;
  timestamp: string;
  payload?: any;
}

export enum ProfilePlan {
  Plus = 'Plus',
  Pro100 = 'Pro100',
  Pro200 = 'Pro200',
  Unknown = 'Unknown',
}

export enum SnapshotStatus {
  Missing = 'Missing',
  Captured = 'Captured',
  Invalid = 'Invalid',
  Unknown = 'Unknown',
}

export enum VerificationStatus {
  Verified = 'Verified',
  Unverified = 'Unverified',
  VerifyUnavailable = 'VerifyUnavailable',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

export enum LimitStatus {
  Available = 'Available',
  Low = 'Low',
  Exhausted = 'Exhausted',
  Unknown = 'Unknown',
}

export enum RecommendationStatus {
  Stay = 'Stay',
  SwitchSoon = 'SwitchSoon',
  SwitchNow = 'SwitchNow',
  VerifyFirst = 'VerifyFirst',
  Unknown = 'Unknown',
}

export interface ProfileRecord {
  id: string;
  alias: string;
  plan: ProfilePlan;
  capacityMultiplier: number;
  priority: number;
  snapshotPath: string | null;
  snapshotStatus: SnapshotStatus;
  createdAt: string;
  updatedAt: string;
  lastActivatedAt: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: VerificationStatus;
  fiveHourStatus: LimitStatus;
  weeklyStatus: LimitStatus;
  creditsStatus: LimitStatus;
  observedResetAt: string | null;
  lastLimitBanner: string | null;
  notes: string | null;
  recommendation: RecommendationStatus;
  recommendationReason: string | null;
}

export enum UsageSnapshotSource {
  Manual = 'Manual',
  CodexBanner = 'CodexBanner',
  UsageDashboard = 'UsageDashboard',
  Unknown = 'Unknown',
}

export interface ProfileUsageSnapshot {
  id: string;
  profileId: string;
  fiveHourStatus: LimitStatus;
  weeklyStatus: LimitStatus;
  creditsStatus: LimitStatus;
  observedResetAt: string | null;
  lastLimitBanner: string | null;
  notes: string | null;
  source: UsageSnapshotSource;
  createdAt: string;
}

export enum SwitchEventType {
  PROFILE_CREATED = 'PROFILE_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  PROFILE_CAPTURE_REQUESTED = 'PROFILE_CAPTURE_REQUESTED',
  PROFILE_CAPTURE_COMPLETED = 'PROFILE_CAPTURE_COMPLETED',
  PROFILE_CAPTURE_FAILED = 'PROFILE_CAPTURE_FAILED',
  USAGE_SNAPSHOT_UPDATED = 'USAGE_SNAPSHOT_UPDATED',
  SWITCH_RECOMMENDED = 'SWITCH_RECOMMENDED',
  SWITCH_STARTED = 'SWITCH_STARTED',
  SWITCH_DRY_RUN_STARTED = 'SWITCH_DRY_RUN_STARTED',
  SWITCH_DRY_RUN_COMPLETED = 'SWITCH_DRY_RUN_COMPLETED',
  SWITCH_DRY_RUN_FAILED = 'SWITCH_DRY_RUN_FAILED',
  ACTIVE_PROFILE_BACKED_UP = 'ACTIVE_PROFILE_BACKED_UP',
  TARGET_PROFILE_RESTORED = 'TARGET_PROFILE_RESTORED',
  CODEX_LAUNCH_REQUESTED = 'CODEX_LAUNCH_REQUESTED',
  VERIFY_STARTED = 'VERIFY_STARTED',
  VERIFY_SUCCEEDED = 'VERIFY_SUCCEEDED',
  VERIFY_UNAVAILABLE = 'VERIFY_UNAVAILABLE',
  VERIFY_FAILED = 'VERIFY_FAILED',
  SWITCH_COMPLETED = 'SWITCH_COMPLETED',
  SWITCH_FAILED = 'SWITCH_FAILED',
  ROLLBACK_STARTED = 'ROLLBACK_STARTED',
  ROLLBACK_COMPLETED = 'ROLLBACK_COMPLETED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
}

export interface SwitchEvent {
  id: string;
  timestamp: string;
  eventType: SwitchEventType;
  profileId: string | null;
  targetProfileId: string | null;
  severity: 'info' | 'warning' | 'error';
  message: string;
  metadata: Record<string, any>;
}

export interface AppSettingsV2 {
  schemaVersion: number;
  activeProfileId: string | null;
  demoMode: boolean;
  localSwitchingEnabled: boolean;
  codexProfileRootPath: string | null;
  codexLaunchCommand: string | null;
  requireCodexClosedBeforeSwitch: boolean;
  allowProcessStop: boolean;
  autoLaunchAfterSwitch: boolean;
  redactSensitivePathsInLogs: boolean;
}
