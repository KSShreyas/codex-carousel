import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { spawn } from 'child_process';

type Profile = { id: string; alias: string };

const profiles: Profile[] = [{ id: 'profile_1', alias: 'alpha' }];
const switchCalls: Array<{ targetId: string; confirm: boolean }> = [];
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

describe('CLI documented switch command', () => {
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

  it('accepts switch run <profile> --confirm', async () => {
    const result = await runCli(['switch', 'run', 'alpha', '--confirm']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Switch success. Active profile: profile_1');
    expect(switchCalls.at(-1)).toEqual({ targetId: 'profile_1', confirm: true });
  });

  it('accepts switch <profile> --confirm compatibility path', async () => {
    const result = await runCli(['switch', 'alpha', '--confirm']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Switch success. Active profile: profile_1');
    expect(switchCalls.at(-1)).toEqual({ targetId: 'profile_1', confirm: true });
  });
});
