import { describe, expect, it } from 'vitest';
import { CodexDiscoveryService } from '../src/carousel/codexDiscovery';

describe('codex discovery service', () => {
  it('returns safe metadata-only discovery candidates', async () => {
    const svc = new CodexDiscoveryService({
      access: async () => {},
      readdir: async () => ['OpenAI.Codex_abc', 'OtherApp'],
    } as any, 'win32', { LOCALAPPDATA: 'C:/Local', APPDATA: 'C:/Roaming' } as any);

    const result = await svc.discover({ codexProfileRootPath: null, codexLaunchCommand: null, localSwitchingEnabled: false });

    expect(Array.isArray(result.candidates)).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.safeForLogs).toBe(true);
      expect((candidate as any).contents).toBeUndefined();
      expect((candidate as any).raw).toBeUndefined();
    }
  });

  it('does not read raw file contents during discovery', async () => {
    let readCalls = 0;
    const fsLike = {
      access: async () => {},
      readdir: async () => [],
      readFile: async () => { readCalls += 1; throw new Error('should not be called'); },
    };

    const svc = new CodexDiscoveryService(fsLike as any, 'win32', { LOCALAPPDATA: 'C:/Local', APPDATA: 'C:/Roaming' } as any);
    await svc.discover({ codexProfileRootPath: null, codexLaunchCommand: null, localSwitchingEnabled: false });

    expect(readCalls).toBe(0);
  });
});
