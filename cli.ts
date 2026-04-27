/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';

const program = new Command();
const API_BASE = 'http://localhost:3000/api';

program
  .name('carousel')
  .description('Codex Carousel Manual Profile Switcher CLI')
  .version('2.0.0');

program.command('status').action(async () => {
  const res = await fetch(`${API_BASE}/status`);
  const data = await res.json() as any;
  console.log(JSON.stringify(data, null, 2));
});

const profiles = program.command('profiles').description('Profile management');

profiles.command('list').action(async () => {
  const res = await fetch(`${API_BASE}/profiles`);
  const data = await res.json() as any[];
  console.table(data.map((p) => ({
    ID: p.id,
    Alias: p.alias,
    Plan: p.plan,
    Priority: p.priority,
    Recommendation: p.recommendation,
  })));
});

profiles.command('create')
  .requiredOption('--alias <alias>')
  .option('--plan <plan>', 'Plus | Pro100 | Pro200 | Unknown', 'Unknown')
  .option('--priority <priority>', 'Priority', '1')
  .option('--snapshotPath <snapshotPath>')
  .action(async (options) => {
    const res = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: options.alias,
        plan: options.plan,
        priority: Number.parseInt(options.priority, 10),
        snapshotPath: options.snapshotPath ?? null,
      }),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  });

profiles.command('update <id>')
  .option('--alias <alias>')
  .option('--plan <plan>')
  .option('--priority <priority>')
  .option('--verificationStatus <verificationStatus>')
  .option('--snapshotStatus <snapshotStatus>')
  .option('--notes <notes>')
  .action(async (id, options) => {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(options)) {
      if (v !== undefined) payload[k] = v;
    }
    if (payload.priority) payload.priority = Number.parseInt(String(payload.priority), 10);
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  });

const usage = program.command('usage').description('Observed usage snapshots');
usage.command('update <profileId>')
  .requiredOption('--fiveHourStatus <status>')
  .requiredOption('--weeklyStatus <status>')
  .requiredOption('--creditsStatus <status>')
  .option('--observedResetAt <datetime>')
  .option('--lastLimitBanner <banner>')
  .option('--notes <notes>')
  .option('--source <source>', 'Manual | CodexBanner | UsageDashboard | Unknown', 'Manual')
  .action(async (profileId, options) => {
    const res = await fetch(`${API_BASE}/profiles/${profileId}/usage-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  });

program.command('ledger').action(async () => {
  const res = await fetch(`${API_BASE}/ledger`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
});

program.command('recommend').action(async () => {
  const res = await fetch(`${API_BASE}/recommendations/recompute`, { method: 'POST' });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
});

program.command('doctor').action(async () => {
  const res = await fetch(`${API_BASE}/doctor`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
});

program.parse();
