import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('switch API/CLI/UI wiring', () => {
  const server = fs.readFileSync('server.ts', 'utf-8');
  const cli = fs.readFileSync('cli.ts', 'utf-8');
  const app = fs.readFileSync('src/App.tsx', 'utf-8');

  it('implements capture-current and real switch APIs', () => {
    expect(server).toContain('/api/profiles/capture-current');
    expect(server).toContain("app.post('/api/profiles/:id/switch'");
    expect(server).toContain("app.post('/api/profiles/:id/safety-check'");
    expect(server).toContain('executeSwitch');
  });

  it('requires confirmation for real switch pathways', () => {
    expect(server).toContain('confirm = req.body?.confirm === true');
    expect(cli).toContain("requiredOption('--confirm'");
    expect(app).toContain('I understand Codex should be closed before switching.');
  });

  it('includes launch API and CLI command', () => {
    expect(server).toContain('/api/codex/launch');
    expect(cli).toContain("program.command('launch')");
    expect(app).toContain('Open Codex');
  });
});
