import fs from 'fs/promises';
import { DurableStore } from './durableStore';
import { SwitchEventType } from './types';
import { normalizeCodexLaunchCommand } from './launchCommand';

export type ApplyCodexSetupInput = {
  codexProfileRootPath: string | null;
  codexLaunchCommand: string | null;
  enableSwitching: boolean;
};

export async function applyCodexSetup(store: DurableStore, input: ApplyCodexSetupInput) {
  const profileRoot = input.codexProfileRootPath?.trim() || null;
  const launchCommand = normalizeCodexLaunchCommand(input.codexLaunchCommand);

  if (input.enableSwitching) {
    if (!profileRoot) {
      throw new Error('Setup profile root is required before enabling switching.');
    }
    try {
      const stat = await fs.stat(profileRoot);
      if (!stat.isDirectory()) throw new Error('not-dir');
    } catch {
      throw new Error('Setup profile root does not exist.');
    }
  }

  const patched = await store.patchSettings({
    codexProfileRootPath: profileRoot,
    codexLaunchCommand: launchCommand,
    localSwitchingEnabled: input.enableSwitching,
  });

  store.appendEvent({
    eventType: SwitchEventType.SWITCH_RECOMMENDED,
    profileId: patched.activeProfileId,
    targetProfileId: null,
    severity: 'info',
    message: 'Codex setup updated',
    metadata: {
      setupComplete: Boolean(input.enableSwitching && profileRoot),
      hasLaunchCommand: Boolean(launchCommand),
    },
  });
  await store.save();

  return {
    setupComplete: Boolean(input.enableSwitching && profileRoot),
    settings: patched,
  };
}
