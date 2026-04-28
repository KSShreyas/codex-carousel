import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { spawn } from 'child_process';

type Profile = { id: string; alias: string };

const profiles: Profile[] = [{ id: 'profile_1', alias: 'Shreyas Pro' }];
const switchCalls: Array<{ targetId: string; confirm: boolean }> = [];
const dryRunCalls: string[] = [];
const statusCalls: number[] = [];
const clearLockCalls: number[] = [];
let server: http.Server;
let apiBase: string;

function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const proc = spawn('node', ['./node_modules/tsx/dist/cli.mjs', 'cli.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, CAROUSEL_API_BASE: apiBase },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('CLI switch command', () => {
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = req.url || '/';
      if (req.method === 'GET' && url === '/api/profiles') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(profiles));
        return;
      }

      if (req.method === 'POST' && url === '/api/profiles/profile_1/switch') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
          const parsed = body ? JSON.parse(body) : {};
          switchCalls.push({ targetId: 'profile_1', confirm: parsed.confirm === true });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ activeProfileId: 'profile_1', verification: 'VerifyUnavailable' }));
        });
        return;
      }

      if (req.method === 'POST' && url === '/api/profiles/profile_1/switch/dry-run') {
        dryRunCalls.push(url);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ targetProfileId: 'profile_1', backupPlan: [{}], restorePlan: [{}], warnings: [] }));
        return;
      }

      if (req.method === 'GET' && url === '/api/switch/status') {
        statusCalls.push(Date.now());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ locked: false, stale: false }));
        return;
      }

      if (req.method === 'POST' && url === '/api/switch/lock/clear') {
        clearLockCalls.push(Date.now());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ cleared: true }));
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as AddressInfo).port;
    apiBase = `http://127.0.0.1:${port}/api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('help shows explicit switch run command', async () => {
    const result = await runCli(['switch', '--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('run [options] <profileOrAlias>');
  });

  it('switch run without --confirm fails', async () => {
    const result = await runCli(['switch', 'run', 'Shreyas Pro']);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("required option '--confirm'");
  });

  it('switch run with --confirm reaches backend endpoint', async () => {
    const result = await runCli(['switch', 'run', 'Shreyas Pro', '--confirm']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Switch success. Active profile: profile_1');
    expect(switchCalls.at(-1)).toEqual({ targetId: 'profile_1', confirm: true });
  });

  it('switch run resolves by profile id too', async () => {
    const result = await runCli(['switch', 'run', 'profile_1', '--confirm']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Switch success. Active profile: profile_1');
  });

  it('dry-run still works with alias', async () => {
    const result = await runCli(['switch', 'dry-run', 'Shreyas Pro']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('=== SWITCH DRY-RUN ===');
    expect(dryRunCalls.length).toBeGreaterThan(0);
  });

  it('status still works', async () => {
    const result = await runCli(['switch', 'status']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('=== SWITCH STATUS ===');
    expect(statusCalls.length).toBeGreaterThan(0);
  });

  it('clear-lock works with --confirm', async () => {
    const result = await runCli(['switch', 'clear-lock', '--confirm']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Switch lock cleared.');
    expect(clearLockCalls.length).toBeGreaterThan(0);
  });
});
