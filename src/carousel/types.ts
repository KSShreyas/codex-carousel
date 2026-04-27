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
