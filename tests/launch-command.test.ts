import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { DEFAULT_CODEX_LAUNCH_COMMAND, normalizeCodexLaunchCommand } from '../src/carousel/launchCommand';

describe('launch command defaults and normalization', () => {
  it('defaults to Microsoft Store launch command', () => {
    expect(DEFAULT_CODEX_LAUNCH_COMMAND).toBe('explorer.exe shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App');
  });

  it('normalizes AppID and shell:AppsFolder command', () => {
    expect(normalizeCodexLaunchCommand('OpenAI.Codex_2p2nqsd0c76g0!App')).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
    expect(normalizeCodexLaunchCommand('shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App')).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
  });

  it('normalizes explicit start command to explorer.exe', () => {
    const cmd = 'start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"';
    expect(normalizeCodexLaunchCommand(cmd)).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
  });

  it('normalizes invalid legacy command', () => {
    expect(normalizeCodexLaunchCommand('start shell:AppsFolder\\OpenAI.Codex')).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
    expect(normalizeCodexLaunchCommand('shell:AppsFolder\\OpenAI.Codex')).toBe(DEFAULT_CODEX_LAUNCH_COMMAND);
  });

  it('preserves normal .exe command', () => {
    const cmd = 'C:\\Program Files\\Codex\\Codex.exe';
    expect(normalizeCodexLaunchCommand(cmd)).toBe(cmd);
  });

  it('ui keeps raw backend setting names hidden and dashboard without raw command field', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(app).not.toContain('>codexLaunchCommand<');
    expect(app).not.toContain('>codexProfileRootPath<');
    expect(app).not.toContain('>localSwitchingEnabled<');
    expect(app).not.toContain('raw command');
    expect(app).toContain('Open Codex');
    expect(app).not.toContain('Codex app path');
    expect(app).not.toContain('start shell:AppsFolder\\OpenAI.Codex');
    expect(app).not.toContain('shell:AppsFolder\\OpenAI.Codex"');
  });
});
