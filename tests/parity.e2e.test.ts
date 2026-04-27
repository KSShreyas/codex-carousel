import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs/promises';

let server: ChildProcessWithoutNullStreams;

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/health');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not become healthy in time');
}

async function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const proc = spawn('npx', ['tsx', 'cli.ts', ...args], { cwd: process.cwd(), env: process.env });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('CLI/API parity and backend truth', () => {
  beforeAll(async () => {
    await fs.rm('state', { recursive: true, force: true });
    server = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), env: process.env });
    await waitForHealth();
  }, 20000);

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
    }
  });

  it('CLI creates profile and API sees it', async () => {
    const cli = await runCli(['profiles', 'create', '--alias', 'CLI Created', '--plan', 'Plus', '--json']);
    expect(cli.code).toBe(0);

    const created = JSON.parse(cli.stdout);
    const profilesRes = await fetch('http://127.0.0.1:3000/api/profiles');
    const profiles = await profilesRes.json() as any[];
    expect(profiles.some((p) => p.id === created.id)).toBe(true);
  });

  it('API creates profile and CLI sees it', async () => {
    const res = await fetch('http://127.0.0.1:3000/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'API Created', plan: 'Plus', priority: 1 }),
    });
    const created = await res.json() as any;

    const cli = await runCli(['profiles', 'list', '--json']);
    expect(cli.code).toBe(0);
    const listed = JSON.parse(cli.stdout) as any[];
    expect(listed.some((p) => p.id === created.id)).toBe(true);
  });

  it('doctor catches invalid active profile pointer', async () => {
    await fetch('http://127.0.0.1:3000/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeProfileId: 'missing-profile-id' }),
    });

    const doctorRes = await fetch('http://127.0.0.1:3000/api/doctor');
    const doctor = await doctorRes.json() as any;
    expect(doctor.status).toBe('degraded');
    expect((doctor.issues as string[]).some((i) => i.includes('invalid'))).toBe(true);
  });

  it('ledger writes events for create, update, and usage snapshot', async () => {
    const createRes = await fetch('http://127.0.0.1:3000/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'Ledger Test', plan: 'Plus', priority: 1 }),
    });
    const profile = await createRes.json() as any;

    await fetch(`http://127.0.0.1:3000/api/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'updated' }),
    });

    await fetch(`http://127.0.0.1:3000/api/profiles/${profile.id}/usage-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiveHourStatus: 'Available', weeklyStatus: 'Unknown', creditsStatus: 'Unknown', source: 'Manual', notes: 'manual' }),
    });

    const ledgerRes = await fetch('http://127.0.0.1:3000/api/ledger');
    const ledger = await ledgerRes.json() as any[];
    const types = ledger.map((e) => e.eventType);
    expect(types).toContain('PROFILE_CREATED');
    expect(types).toContain('PROFILE_UPDATED');
    expect(types).toContain('USAGE_SNAPSHOT_UPDATED');
  });

  it('backend binds to localhost by default (health available on 127.0.0.1)', async () => {
    const healthRes = await fetch('http://127.0.0.1:3000/api/health');
    expect(healthRes.ok).toBe(true);
  });

  it('UI-consumed API shape matches /api/status payload', async () => {
    const res = await fetch('http://127.0.0.1:3000/api/status');
    const status = await res.json() as any;
    expect(status).toHaveProperty('runtime');
    expect(status.runtime).toHaveProperty('activeProfileId');
    expect(Array.isArray(status.profiles)).toBe(true);
    expect(Array.isArray(status.ledger)).toBe(true);
  });
});
