import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('codex discovery/setup endpoints are wired', () => {
  const server = fs.readFileSync('server.ts', 'utf-8');

  it('includes discovery endpoint', () => {
    expect(server).toContain("app.get('/api/codex/discover'");
  });

  it('includes launch test endpoint', () => {
    expect(server).toContain("app.post('/api/codex/launch-test'");
    expect(server).toContain('commandOverride');
  });

  it('includes setup apply endpoint', () => {
    expect(server).toContain("app.post('/api/codex/setup/apply'");
    expect(server).toContain('enableSwitching: req.body?.enableSwitching === true');
  });

  it('includes friendly add-current-login account endpoint', () => {
    expect(server).toContain("app.post('/api/accounts/add-current-login'");
    expect(server).toContain('code: mapped.code');
  });

  it('includes codex process status endpoint', () => {
    expect(server).toContain("app.get('/api/codex/process-status'");
    expect(server).toContain('getCodexProcessStatus');
  });
});
