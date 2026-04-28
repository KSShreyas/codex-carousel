export function translateBackendError(input: string): string {
  const value = (input || '').replace(/^Error:\s*/i, '').trim();
  if (!value) return 'Something went wrong. Please try again.';

  if (/local switching is disabled/i.test(value)) {
    return 'Setup required. Complete Codex setup before saving or switching accounts.';
  }
  if (/codexProfileRootPath is not configured/i.test(value)) {
    return 'Codex setup incomplete. Run setup before adding or switching accounts.';
  }
  if (/codexLaunchCommand is not configured/i.test(value)) {
    return 'Codex app path is not configured. Set it in Advanced Settings.';
  }
  if (/explicit confirmation is required/i.test(value)) {
    return 'Please confirm before switching accounts.';
  }
  if (/setup profile root is required/i.test(value) || /setup profile root does not exist/i.test(value)) {
    return 'Setup required. Complete Codex setup before saving or switching accounts.';
  }
  if (/codex process appears to be running/i.test(value)) {
    return 'Close Codex and try again, or finish login and then save this account.';
  }
  if (/no codex profile files discovered/i.test(value)) {
    return 'Could not find Codex login data. Open Codex, login, then try Save This Account again.';
  }

  return value;
}
