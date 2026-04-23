/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';

const program = new Command();
const API_BASE = 'http://localhost:3000/api';

program
  .name('carousel')
  .description('Codex Carousel Operator CLI')
  .version('1.0.0');

program.command('status')
  .description('Show current supervisor status')
  .action(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json() as any;
      console.log('--- CODEX CAROUSEL STATUS ---');
      console.log(`Active: ${data.runtime.activeAccountId || 'None'}`);
      console.log(`Uptime: ${data.runtime.uptimeStart}`);
      console.log(`Accounts: ${data.accounts.length}`);
      data.accounts.forEach((a: any) => {
        console.log(`[${a.health.state}] ${a.alias} (${a.id})`);
      });
    } catch (e) {
      console.error('Failed to connect to supervisor');
    }
  });

program.command('rotate')
  .description('Trigger manual account rotation')
  .action(async () => {
    const res = await fetch(`${API_BASE}/switch`, { method: 'POST' });
    if (res.ok) console.log('Rotation successful');
    else console.error('Rotation failed');
  });

program.command('import <alias>')
  .description('Import a new account')
  .option('-p, --priority <number>', 'Account priority', '1')
  .action(async (alias, options) => {
    const res = await fetch(`${API_BASE}/accounts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias, priority: parseInt(options.priority) })
    });
    if (res.ok) console.log(`Imported ${alias}`);
    else console.error('Import failed');
  });

program.command('list')
  .description('List all accounts in pool')
  .action(async () => {
    const res = await fetch(`${API_BASE}/status`);
    const data = await res.json() as any;
    console.table(data.accounts.map((a: any) => ({
      Alias: a.alias,
      ID: a.id,
      State: a.health.state,
      Usage: a.health.usage ? `${a.health.usage.five_hour_remaining}u` : '--'
    })));
  });

program.command('suspend <id>')
  .description('Suspend an account')
  .option('-r, --reason <string>', 'Reason for suspension')
  .action(async (id, options) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: options.reason })
    });
    if (res.ok) console.log(`Account ${id} suspended`);
  });

program.command('reactivate <id>')
  .description('Reactivate a suspended or cooling account')
  .action(async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/reactivate`, { method: 'POST' });
    if (res.ok) console.log(`Account ${id} reactivated`);
  });

program.command('disable <id>')
  .description('Disable account (manual lock)')
  .action(async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/toggle`, { method: 'POST' });
    if (res.ok) console.log(`Account status toggled`);
  });

program.command('ledger')
  .description('Show current durable ledger status')
  .action(async () => {
    const res = await fetch(`${API_BASE}/ledger`);
    const data = await res.json() as any;
    console.log(JSON.stringify(data, null, 2));
  });

program.command('doctor')
  .description('Run system diagnostics')
  .action(async () => {
    const res = await fetch(`${API_BASE}/doctor`);
    const data = await res.json() as any;
    console.log(`Status: ${data.status}`);
    data.issues.forEach((i: string) => console.log(`[!] ${i}`));
  });

program.parse();

