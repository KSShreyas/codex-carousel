import { describe, expect, it } from 'vitest';
import { translateBackendError } from '../src/ui/errorTranslation';

describe('backend error translation helper', () => {
  it('maps setup disabled error to friendly copy', () => {
    expect(translateBackendError('Local switching is disabled')).toBe('Setup required. Complete Codex setup before saving or switching accounts.');
  });

  it('maps missing data folder error to friendly copy', () => {
    expect(translateBackendError('codexProfileRootPath is not configured')).toBe('Codex setup incomplete. Run setup before adding or switching accounts.');
  });

  it('maps missing launch path error to friendly copy', () => {
    expect(translateBackendError('codexLaunchCommand is not configured')).toBe('Codex app path is not configured. Set it in Advanced Settings.');
  });

  it('maps explicit confirmation error', () => {
    expect(translateBackendError('Explicit confirmation is required')).toBe('Please confirm before switching accounts.');
  });

  it('maps missing setup root errors', () => {
    expect(translateBackendError('Setup profile root is required before enabling switching.')).toBe('Setup required. Complete Codex setup before saving or switching accounts.');
    expect(translateBackendError('Setup profile root does not exist.')).toBe('Setup required. Complete Codex setup before saving or switching accounts.');
  });

  it('maps capture/save account specific backend errors', () => {
    expect(translateBackendError('codexProfileRootPath is not configured')).toBe('Codex setup incomplete. Run setup before adding or switching accounts.');
    expect(translateBackendError('Codex process appears to be running')).toBe('Close Codex and try again, or finish login and then save this account.');
    expect(translateBackendError('No Codex profile files discovered under configured codexProfileRootPath')).toBe('Could not find Codex login data. Open Codex, login, then try Save This Account again.');
  });

  it('strips raw Error prefix and falls back gracefully', () => {
    expect(translateBackendError('Error: Network timeout')).toBe('Network timeout');
    expect(translateBackendError('')).toBe('Something went wrong. Please try again.');
  });
});
