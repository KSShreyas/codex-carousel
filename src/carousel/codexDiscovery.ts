import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { DEFAULT_CODEX_LAUNCH_COMMAND, normalizeCodexLaunchCommand } from './launchCommand';

export type DiscoveryCandidate = {
  kind: 'profileRoot' | 'packageRoot' | 'launchCommand';
  pathOrCommand: string;
  exists: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  safeForLogs: true;
};

export type CodexDiscoveryResult = {
  os: NodeJS.Platform;
  candidates: DiscoveryCandidate[];
  recommendedProfileRootPath: string | null;
  recommendedLaunchCommand: string | null;
  codexFound: boolean;
  dataFolderState: 'high' | 'needs_validation' | 'missing' | 'unknown';
  setupComplete: boolean;
  warnings: string[];
};

export type DiscoverySettings = {
  codexProfileRootPath?: string | null;
  codexLaunchCommand?: string | null;
  localSwitchingEnabled?: boolean;
};

type FsLike = Pick<typeof fs, 'access' | 'readdir'>;

export class CodexDiscoveryService {
  constructor(private fileSystem: FsLike = fs, private platform: NodeJS.Platform = process.platform, private env: NodeJS.ProcessEnv = process.env) {}

  private async pathExists(target: string): Promise<boolean> {
    if (!target) return false;
    try {
      await this.fileSystem.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async countEntries(target: string): Promise<number> {
    try {
      const rows = await this.fileSystem.readdir(target);
      return rows.length;
    } catch {
      return 0;
    }
  }

  private getWindowsCandidates(configuredPath?: string | null) {
    const localAppData = this.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    const appData = this.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    const packageRoot = path.join(localAppData, 'Packages');
    const base: string[] = [
      path.join(appData, 'Codex'),
      path.join(localAppData, 'Codex'),
      path.join(this.env.USERPROFILE ?? os.homedir(), '.codex'),
    ];

    if (configuredPath) base.unshift(configuredPath);

    return {
      packageRoot,
      profileRoots: base,
      storeSubdirs: ['LocalState', 'RoamingState', 'LocalCache', path.join('LocalCache', 'Roaming'), path.join('LocalCache', 'Local')],
    };
  }

  async discover(settings: DiscoverySettings): Promise<CodexDiscoveryResult> {
    const candidates: DiscoveryCandidate[] = [];
    const warnings: string[] = [];
    const windows = this.getWindowsCandidates(settings.codexProfileRootPath);

    const packageExists = await this.pathExists(windows.packageRoot);
    candidates.push({
      kind: 'packageRoot',
      pathOrCommand: windows.packageRoot,
      exists: packageExists,
      confidence: this.platform === 'win32' ? 'high' : 'low',
      reason: packageExists ? 'Windows package directory exists.' : 'Windows package directory not found.',
      safeForLogs: true,
    });

    if (packageExists) {
      const packageNames = await this.fileSystem.readdir(windows.packageRoot).catch(() => [] as string[]);
      const codexPackages = packageNames.filter((name) => name.toLowerCase().startsWith('openai.codex_'));
      for (const pkgName of codexPackages) {
        const pkgPath = path.join(windows.packageRoot, pkgName);
        candidates.push({
          kind: 'packageRoot',
          pathOrCommand: pkgPath,
          exists: true,
          confidence: 'high',
          reason: 'Codex Store package directory found.',
          safeForLogs: true,
        });

        for (const subdir of windows.storeSubdirs) {
          const subdirPath = path.join(pkgPath, subdir);
          const exists = await this.pathExists(subdirPath);
          const fileCount = exists ? await this.countEntries(subdirPath) : 0;
          candidates.push({
            kind: 'profileRoot',
            pathOrCommand: subdirPath,
            exists,
            confidence: exists ? 'high' : 'low',
            reason: exists ? `${subdir} exists (${fileCount} entries).` : `${subdir} is missing.`,
            safeForLogs: true,
          });
        }
      }
    }

    for (const profileRoot of windows.profileRoots) {
      const exists = await this.pathExists(profileRoot);
      const fileCount = exists ? await this.countEntries(profileRoot) : 0;
      candidates.push({
        kind: 'profileRoot',
        pathOrCommand: profileRoot,
        exists,
        confidence: exists ? 'medium' : 'low',
        reason: exists ? `Directory found (${fileCount} entries).` : 'Directory not found.',
        safeForLogs: true,
      });
    }

    const codexPackageDetected = candidates.some((c) => c.kind === 'packageRoot' && c.exists && c.pathOrCommand.toLowerCase().includes('openai.codex_2p2nqsd0c76g0'));

    if (settings.codexLaunchCommand) {
      candidates.push({
        kind: 'launchCommand',
        pathOrCommand: normalizeCodexLaunchCommand(settings.codexLaunchCommand) ?? settings.codexLaunchCommand,
        exists: true,
        confidence: 'high',
        reason: 'Using configured launch command.',
        safeForLogs: true,
      });
    } else if (codexPackageDetected && this.platform === 'win32') {
      candidates.push({
        kind: 'launchCommand',
        pathOrCommand: DEFAULT_CODEX_LAUNCH_COMMAND,
        exists: true,
        confidence: 'high',
        reason: 'Codex Microsoft Store AppID detected; prefilled launch command.',
        safeForLogs: true,
      });
    } else {
      candidates.push({
        kind: 'launchCommand',
        pathOrCommand: '',
        exists: false,
        confidence: 'low',
        reason: 'Launch command not detected. Manual setup needed.',
        safeForLogs: true,
      });
      warnings.push('Open Codex command is not configured. Set it in setup to enable Open Codex.');
    }

    const recommendedProfileRootPath = candidates.find((c) => c.kind === 'profileRoot' && c.exists && (c.confidence === 'high' || c.confidence === 'medium'))?.pathOrCommand ?? null;
    const recommendedLaunchCommand = candidates.find((c) => c.kind === 'launchCommand' && c.exists)?.pathOrCommand || null;
    const codexFound = candidates.some((c) => c.kind === 'packageRoot' && c.exists && c.pathOrCommand.toLowerCase().includes('openai.codex_'));
    const dataFolderState: CodexDiscoveryResult['dataFolderState'] = recommendedProfileRootPath
      ? (recommendedProfileRootPath.toLowerCase().includes('localstate') ? 'high' : 'needs_validation')
      : (codexFound ? 'missing' : 'unknown');
    const setupComplete = Boolean(settings.localSwitchingEnabled && recommendedProfileRootPath && recommendedLaunchCommand && codexFound);

    if (!recommendedProfileRootPath) {
      warnings.push('Codex data folder was not found automatically. Choose it manually in setup.');
    }

    return {
      os: this.platform,
      candidates,
      recommendedProfileRootPath,
      recommendedLaunchCommand,
      codexFound,
      dataFolderState,
      setupComplete,
      warnings,
    };
  }
}
