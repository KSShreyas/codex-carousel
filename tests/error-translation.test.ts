import { describe, expect, it } from 'vitest';
import { translateBackendError } from '../src/ui/errorTranslation';

describe('backend error translation helper', () => {
  it('maps setup disabled error to friendly copy', () => {
    expect(translateBackendError('Local switching is disabled')).toBe('Account switching setup is not complete.');
  });

  it('maps missing data folder error to friendly copy', () => {
    expect(translateBackendError('codexProfileRootPath is not configured')).toBe('Codex data folder is not configured. Run setup first.');
  });

  it('maps missing launch path error to friendly copy', () => {
    expect(translateBackendError('codexLaunchCommand is not configured')).toBe('Open Codex command is not configured. Set it in Advanced Settings.');
  });

  it('maps explicit confirmation error', () => {
    expect(translateBackendError('Explicit confirmation is required')).toBe('Please confirm before switching accounts.');
  });

  it('maps missing setup root errors', () => {
    expect(translateBackendError('Setup profile root is required before enabling switching.')).toBe('Setup required. Complete Codex setup before saving or switching accounts.');
    expect(translateBackendError('Setup profile root does not exist.')).toBe('Setup required. Complete Codex setup before saving or switching accounts.');
  });

  it('maps capture/save account specific backend errors', () => {
    expect(translateBackendError('codexProfileRootPath is not configured')).toBe('Codex data folder is not configured. Run setup first.');
    expect(translateBackendError('Codex process appears to be running')).toBe('Codex is still open. Close Codex completely, then click Check Again.');
    expect(translateBackendError('No Codex profile files discovered under configured codexProfileRootPath')).toBe('Codex login data was not found. Open Codex, sign in, close Codex, then try again.');
  });

  it('strips raw Error prefix and falls back gracefully', () => {
    expect(translateBackendError('Error: Network timeout')).toBe('Something went wrong. Please try again.');
    expect(translateBackendError('')).toBe('Something went wrong. Please try again.');
  });
});
