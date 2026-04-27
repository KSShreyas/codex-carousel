export type FriendlySettings = {
  activeProfileId: string | null;
  switchingSetupReady: boolean;
  dataFolder: string;
  appPath: string;
  requireClosedBeforeSwitch: boolean;
  openAfterSwitch: boolean;
};

type RawSettings = {
  activeProfileId?: string | null;
  localSwitchingEnabled?: boolean;
  codexProfileRootPath?: string | null;
  codexLaunchCommand?: string | null;
  requireCodexClosedBeforeSwitch?: boolean;
  autoLaunchAfterSwitch?: boolean;
};

export function adaptSettings(raw: RawSettings): FriendlySettings {
  return {
    activeProfileId: raw.activeProfileId ?? null,
    switchingSetupReady: Boolean(raw.localSwitchingEnabled),
    dataFolder: raw.codexProfileRootPath ?? '',
    appPath: raw.codexLaunchCommand ?? '',
    requireClosedBeforeSwitch: raw.requireCodexClosedBeforeSwitch ?? true,
    openAfterSwitch: raw.autoLaunchAfterSwitch ?? false,
  };
}

export function toSettingsPatch(friendly: FriendlySettings): RawSettings {
  return {
    activeProfileId: friendly.activeProfileId,
    localSwitchingEnabled: friendly.switchingSetupReady,
    codexProfileRootPath: friendly.dataFolder || null,
    codexLaunchCommand: friendly.appPath || null,
    requireCodexClosedBeforeSwitch: friendly.requireClosedBeforeSwitch,
    autoLaunchAfterSwitch: friendly.openAfterSwitch,
  };
}
