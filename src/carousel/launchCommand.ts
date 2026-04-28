export const STORE_APP_ID = 'OpenAI.Codex_2p2nqsd0c76g0!App';
export const STORE_SHELL_TARGET = `shell:AppsFolder\\${STORE_APP_ID}`;
export const DEFAULT_CODEX_LAUNCH_COMMAND = `explorer.exe ${STORE_SHELL_TARGET}`;

const LEGACY_BAD_SHELL = 'shell:AppsFolder\\OpenAI.Codex';

function normalizeStartShellCommand(raw: string): string {
  const match = raw.match(/^start\s+""\s+"(shell:appsfolder\\.+)"$/i);
  if (match?.[1]) {
    return `explorer.exe ${match[1]}`;
  }
  const legacyMatch = raw.match(/^start\s+shell:appsfolder\\openai\.codex$/i);
  if (legacyMatch) {
    return DEFAULT_CODEX_LAUNCH_COMMAND;
  }
  return raw;
}

export function normalizeCodexLaunchCommand(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower === STORE_APP_ID.toLowerCase()) return DEFAULT_CODEX_LAUNCH_COMMAND;
  if (lower === STORE_SHELL_TARGET.toLowerCase()) return DEFAULT_CODEX_LAUNCH_COMMAND;
  if (lower === LEGACY_BAD_SHELL.toLowerCase()) return DEFAULT_CODEX_LAUNCH_COMMAND;
  if (lower === `start ${LEGACY_BAD_SHELL}`.toLowerCase()) return DEFAULT_CODEX_LAUNCH_COMMAND;
  if (lower === `start "" "${LEGACY_BAD_SHELL}"`.toLowerCase()) return DEFAULT_CODEX_LAUNCH_COMMAND;

  if (/^explorer\.exe\s+shell:appsfolder\\/i.test(raw)) return raw;
  if (/^start\s+/i.test(raw)) return normalizeStartShellCommand(raw);
  if (/^shell:appsfolder\\/i.test(raw)) return `explorer.exe ${raw}`;

  return raw;
}

export const normalizeLaunchCommand = normalizeCodexLaunchCommand;

export function looksLikeCodexStoreAppId(input: string | null | undefined): boolean {
  const value = (input ?? '').toLowerCase();
  return value.includes(STORE_APP_ID.toLowerCase());
}
