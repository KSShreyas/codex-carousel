import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('add account error handling ui', () => {
  it('shows friendly modal error for add-current-login 400 responses', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(app).toContain('setAddAccountError(mapped);');
    expect(app).toContain('Codex is still open. Close Codex completely, then click Check Again.');
    expect(app).toContain('Codex login data was not found. Open Codex, sign in, close Codex, then try again.');
    expect(app).toContain('Check Again');
    expect(app).toContain('{addAccountError && <p className="mt-2 rounded border border-rose-500/50 bg-rose-900/20 px-2 py-1.5 text-rose-100">{addAccountError}</p>}');
  });

  it('frontend does not contain stale OpenAI.Codex shell command variants', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(app).not.toContain('start shell:AppsFolder\\OpenAI.Codex');
    expect(app).not.toContain('shell:AppsFolder\\OpenAI.Codex"');
    expect(app).toContain('OpenAI.Codex_2p2nqsd0c76g0!App');
  });
});
