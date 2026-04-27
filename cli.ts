/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';

const program = new Command();
const API_BASE = 'http://127.0.0.1:3000/api';

program
  .name('carousel')
  .description('Codex Carousel Manual Profile Switcher CLI')
  .version('3.0.0')
  .option('--json', 'Output JSON');

function print(programRef: Command, data: any, humanRenderer?: (payload: any) => void) {
  if (programRef.opts().json || !humanRenderer) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  humanRenderer(data);
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

program.command('status').action(async () => {
  const data = await call('/status');
  print(program, data, (s) => {
    console.log('=== CODEX CAROUSEL STATUS ===');
    console.log(`Active Profile: ${s.runtime?.activeProfileId ?? 'None'}`);
    console.log(`Profiles: ${s.profiles?.length ?? 0}`);
    console.log(`Ledger Events: ${s.ledger?.length ?? 0}`);
  });
});

const profiles = program.command('profiles').description('Profile management');
profiles.command('list').action(async () => {
  const data = await call('/profiles');
  print(program, data, (rows) => {
    console.table(rows.map((p: any) => ({
      ID: p.id,
      Alias: p.alias,
      Plan: p.plan,
      Priority: p.priority,
      Recommendation: p.recommendation,
    })));
  });
});

profiles.command('create')
  .requiredOption('--alias <alias>')
  .option('--plan <plan>', 'Plus|Pro100|Pro200|Unknown', 'Plus')
  .option('--priority <priority>', 'Priority', '1')
  .option('--snapshot-path <snapshotPath>')
  .action(async (options) => {
    const data = await call('/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: options.alias,
        plan: options.plan,
        priority: Number.parseInt(options.priority, 10),
        snapshotPath: options.snapshotPath ?? null,
      }),
    });

    print(program, data, (p) => {
      console.log(`Created profile ${p.alias} (${p.id})`);
    });
  });

profiles.command('update <id>')
  .option('--alias <alias>')
  .option('--plan <plan>')
  .option('--priority <priority>')
  .option('--verification-status <verificationStatus>')
  .option('--snapshot-status <snapshotStatus>')
  .option('--notes <notes>')
  .action(async (id, options) => {
    const payload: Record<string, any> = {};
    if (options.alias !== undefined) payload.alias = options.alias;
    if (options.plan !== undefined) payload.plan = options.plan;
    if (options.priority !== undefined) payload.priority = Number.parseInt(options.priority, 10);
    if (options.verificationStatus !== undefined) payload.verificationStatus = options.verificationStatus;
    if (options.snapshotStatus !== undefined) payload.snapshotStatus = options.snapshotStatus;
    if (options.notes !== undefined) payload.notes = options.notes;

    const data = await call(`/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    print(program, data, (p) => {
      console.log(`Updated profile ${p.id}`);
    });
  });

const usage = program.command('usage').description('Observed usage snapshots');
usage.command('update <profileId>')
  .requiredOption('--five-hour <status>')
  .requiredOption('--weekly <status>')
  .requiredOption('--credits <status>')
  .option('--observed-reset-at <datetime>')
  .option('--last-limit-banner <banner>')
  .option('--notes <notes>')
  .option('--source <source>', 'Manual|CodexBanner|UsageDashboard|Unknown', 'Manual')
  .action(async (profileId, options) => {
    const data = await call(`/profiles/${profileId}/usage-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiveHourStatus: options.fiveHour,
        weeklyStatus: options.weekly,
        creditsStatus: options.credits,
        observedResetAt: options.observedResetAt ?? null,
        lastLimitBanner: options.lastLimitBanner ?? null,
        notes: options.notes ?? null,
        source: options.source,
      }),
    });

    print(program, data, (s) => {
      console.log(`Saved usage snapshot ${s.id} for ${s.profileId}`);
    });
  });

program.command('recommend').action(async () => {
  const data = await call('/recommendations/recompute', { method: 'POST' });
  print(program, data, (r) => {
    console.log(`Active recommendation: ${r.summary?.activeRecommendation ?? 'Unknown'}`);
  });
});

program.command('ledger').action(async () => {
  const data = await call('/ledger');
  print(program, data, (entries) => {
    console.table(entries.slice(0, 20).map((e: any) => ({
      Time: e.timestamp,
      Event: e.eventType,
      Severity: e.severity,
      Message: e.message,
    })));
  });
});

program.command('doctor').action(async () => {
  const data = await call('/doctor');
  print(program, data, (d) => {
    console.log(`Doctor status: ${d.status}`);
    if (d.issues?.length) {
      d.issues.forEach((i: string) => console.log(` - ${i}`));
    } else {
      console.log('No issues detected.');
    }
  });
});

program.parse();
