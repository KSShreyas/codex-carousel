export function translateBackendError(input: string): string {
  const value = (input || '').replace(/^Error:\s*/i, '').trim();
  if (!value) return 'Something went wrong. Please try again.';

  if (/local switching is disabled/i.test(value)) {
    return 'Account switching setup is not complete.';
  }
  if (/codexProfileRootPath is not configured/i.test(value)) {
    return 'Codex data folder is not configured. Run setup first.';
  }
  if (/codexLaunchCommand is not configured/i.test(value)) {
    return 'Open Codex command is not configured. Set it in Advanced Settings.';
  }
  if (/explicit confirmation is required/i.test(value)) {
    return 'Please confirm before switching accounts.';
  }
  if (/setup profile root is required/i.test(value) || /setup profile root does not exist/i.test(value)) {
    return 'Setup required. Complete Codex setup before saving or switching accounts.';
  }
  if (/codex process appears to be running/i.test(value)) {
    return 'Codex is still open. Close Codex completely, then click Check Again.';
  }
  if (/no codex profile files discovered/i.test(value)) {
    return 'Codex login data was not found. Open Codex, sign in, close Codex, then try again.';
  }
  if (/preflight failed|dry-run produced warnings|switch lock exists/i.test(value)) {
    return 'Safety Check failed. Fix setup issues, close Codex, then try again.';
  }
  if (/real switch failed|could not switch account/i.test(value)) {
    return 'Could not switch account. Run Safety Check and try again.';
  }

  return 'Something went wrong. Please try again.';
}
