import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { DEFAULT_CODEX_LAUNCH_COMMAND, normalizeLaunchCommand } from '../src/carousel/launchCommand';

describe('launch command defaults and normalization', () => {
  it('defaults to Microsoft Store launch command', () => {
    expect(DEFAULT_CODEX_LAUNCH_COMMAND).toBe('start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"');
  });

  it('accepts and normalizes shell:AppsFolder command', () => {
    expect(normalizeLaunchCommand('shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App')).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
  });

  it('preserves explicit start command', () => {
    const cmd = 'start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"';
    expect(normalizeLaunchCommand(cmd)).toBe(cmd);
  });

  it('ui keeps raw backend setting names hidden and dashboard without raw command field', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(app).not.toContain('>codexLaunchCommand<');
    expect(app).not.toContain('>codexProfileRootPath<');
    expect(app).not.toContain('>localSwitchingEnabled<');
    expect(app).not.toContain('raw command');
    expect(app).toContain('Open Codex');
    expect(app).not.toContain('Codex app path');
  });
});
