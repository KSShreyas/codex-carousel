const STORE_APP_ID = 'OpenAI.Codex_2p2nqsd0c76g0!App';
export const DEFAULT_CODEX_LAUNCH_COMMAND = `start "" "shell:AppsFolder\\${STORE_APP_ID}"`;

export function normalizeLaunchCommand(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  if (/^start\s+/i.test(raw)) return raw;
  if (/^shell:appsfolder\\/i.test(raw)) {
    return `start "" "${raw}"`;
  }
  return raw;
}

export function looksLikeCodexStoreAppId(input: string | null | undefined): boolean {
  const value = (input ?? '').toLowerCase();
  return value.includes(STORE_APP_ID.toLowerCase());
}
