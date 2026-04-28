/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import path from 'path';
import { AppConfig } from './types';

export const ConfigSchema = z.object({
  stateDir: z.string().default('./state'),
  logDir: z.string().default('./logs'),
  inboxDir: z.string().default('./inbox/auth'),
  accountsDir: z.string().default('./state/accounts'),
  stickyPrimary: z.boolean().default(true),
  fiveHourThreshold: z.number().default(5), // Switch if < 5 requests left
  weeklyThreshold: z.number().default(20),
  cooldownDurationMinutes: z.number().default(300), // 5 hours default
  rateLimitCooldownMinutes: z.number().default(60),
  authFailureCooldownMinutes: z.number().default(120),
  recoveryProbeIntervalMinutes: z.number().default(15),
  maxConsecutiveFailures: z.number().default(3),
  fairRotation: z.boolean().default(true),
  recentUsePenalty: z.number().default(50),
  failurePenalty: z.number().default(100),
  uiRefreshIntervalMs: z.number().default(2000),
  bridgeReloadTimeoutMs: z.number().default(10000),
  ledgerRetentionCount: z.number().default(50),
  demoMode: z.boolean().default(false),
});

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const result = ConfigSchema.parse({
    demoMode: process.env.CAROUSEL_DEMO_MODE === 'true',
    stateDir: process.env.CAROUSEL_STATE_DIR,
    logDir: process.env.CAROUSEL_LOG_DIR,
    inboxDir: process.env.CAROUSEL_INBOX_DIR,
    accountsDir: process.env.CAROUSEL_ACCOUNTS_DIR,
    ...overrides,
  });
  
  // Resolve paths
  return {
    ...result,
    stateDir: path.resolve(process.cwd(), result.stateDir),
    logDir: path.resolve(process.cwd(), result.logDir),
    inboxDir: path.resolve(process.cwd(), result.inboxDir),
    accountsDir: path.resolve(process.cwd(), result.accountsDir),
  };
}
