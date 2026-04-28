/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { adaptSettings, type FriendlySettings, toSettingsPatch } from './ui/settingsAdapter';
import { translateBackendError } from './ui/errorTranslation';
import { computeDirty, shouldSyncDraftFromSaved } from './ui/draftState';
import { DEFAULT_CODEX_LAUNCH_COMMAND, normalizeCodexLaunchCommand } from './carousel/launchCommand';

type LimitStatus = 'Available' | 'Low' | 'Exhausted' | 'Unknown';
type Source = 'Manual' | 'CodexBanner' | 'UsageDashboard' | 'Unknown';

type Profile = {
  id: string;
  alias: string;
  plan: string;
  verificationStatus: string;
  fiveHourStatus: LimitStatus;
  weeklyStatus: LimitStatus;
  creditsStatus: LimitStatus;
  observedResetAt: string | null;
  recommendation: string;
  recommendationReason: string | null;
  lastActivatedAt: string | null;
  snapshotStatus?: string;
};

type LedgerEvent = {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

type Health = {
  ok: boolean;
  version: string;
  storageStatus: string;
  demoMode: boolean;
  activeProfileId: string | null;
  ledgerWritable: boolean;
  profileCount: number;
  lastEventTimestamp: string | null;
};

type Diagnostics = {
  status: string;
  issues: string[];
  setup?: {
    codexFound: boolean;
    dataFolderConfigured: boolean;
    appPathConfigured: boolean;
    switchingSetupComplete: boolean;
    missingSteps: string[];
  };
};

type UsageSnapshot = {
  id: string;
  createdAt: string;
  source: string;
  fiveHourStatus: string;
  weeklyStatus: string;
  creditsStatus: string;
  observedResetAt: string | null;
  notes: string | null;
};

type SafetyResult = {
  ok: boolean;
  targetProfileId: string;
  checks: Array<{
    label: 'Current account backup' | 'Target account saved login' | 'Codex status' | 'Setup' | 'Result';
    status: 'Ready' | 'Warning' | 'Failed' | 'Unknown';
    detail: string;
  }>;
  canSwitch: boolean;
  warnings: string[];
};

type DiscoveryCandidate = {
  kind: 'profileRoot' | 'packageRoot' | 'launchCommand';
  pathOrCommand: string;
  exists: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  safeForLogs: true;
};

type DiscoveryResult = {
  os: string;
  candidates: DiscoveryCandidate[];
  recommendedProfileRootPath: string | null;
  recommendedLaunchCommand: string | null;
  codexFound: boolean;
  dataFolderState: 'high' | 'needs_validation' | 'missing' | 'unknown';
  setupComplete: boolean;
  warnings: string[];
};

type AddAccountErrorCode = 'CODEX_RUNNING' | 'SETUP_REQUIRED' | 'DATA_FOLDER_MISSING' | 'NO_LOGIN_DATA_FOUND' | 'UNKNOWN';

type CodexProcessStatus = {
  running: boolean;
  processes: string[];
};

const cardClass = 'rounded-2xl border border-zinc-800/90 bg-zinc-950/85 p-5 shadow-[0_14px_34px_rgba(0,0,0,.45)] backdrop-blur';
const inputClass = 'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500 focus:outline-none';
const buttonPrimaryClass = 'rounded-lg border border-emerald-400/60 bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(0,0,0,.25)] transition hover:brightness-110';
const buttonSecondaryClass = 'rounded-lg border border-zinc-600/90 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-500 hover:text-cyan-200';
const chipClass = 'inline-flex items-center rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-300';

function StatusBadge({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'ok'
    ? 'border-emerald-500/60 bg-emerald-900/20 text-emerald-200'
    : tone === 'warn'
      ? 'border-amber-500/60 bg-amber-900/20 text-amber-200'
      : tone === 'bad'
        ? 'border-rose-500/60 bg-rose-900/20 text-rose-200'
        : 'border-zinc-600/60 bg-zinc-900/60 text-zinc-200';
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>{label}</span>;
}

function friendlyRecommendation(profile: Profile | null): string {
  if (!profile) return 'No recommendation because usage status is unknown';
  const reco = (profile.recommendation || '').toLowerCase();
  if (reco.includes('stay')) return 'Stay on this account';
  if (reco.includes('switch') || profile.fiveHourStatus === 'Low') return 'Usage status low, consider switching before a large task';
  if (profile.fiveHourStatus === 'Exhausted' || profile.weeklyStatus === 'Exhausted' || profile.creditsStatus === 'Exhausted') {
    return 'This account appears unavailable based on your manual snapshot';
  }
  if ((profile.verificationStatus || '').toLowerCase().includes('unknown') || (profile.verificationStatus || '').toLowerCase().includes('unverified')) {
    return 'Verify this account before using it';
  }
  return 'No recommendation because usage status is unknown';
}

function toFriendlyActivity(evt: LedgerEvent): string {
  const map: Record<string, string> = {
    PROFILE_CREATED: 'Saved a new account.',
    PROFILE_UPDATED: 'Updated account details.',
    USAGE_SNAPSHOT_UPDATED: 'Updated usage status.',
    SWITCH_STARTED: 'Started account switch.',
    SWITCH_DRY_RUN_STARTED: 'Started Safety Check.',
    SWITCH_DRY_RUN_COMPLETED: 'Safety Check completed.',
    SWITCH_DRY_RUN_FAILED: 'Safety Check found an issue.',
    SWITCH_COMPLETED: 'Switched account successfully.',
    SWITCH_FAILED: 'Account switch failed.',
    PROFILE_CAPTURE_COMPLETED: 'Saved current Codex login as an account.',
    PROFILE_CAPTURE_FAILED: 'Could not save current Codex login.',
    CODEX_LAUNCHED: 'Opened Codex.',
  };
  return map[evt.eventType] ?? evt.message;
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [savedSettings, setSavedSettings] = useState<FriendlySettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<FriendlySettings | null>(null);
  const [settingsTouched, setSettingsTouched] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [applySetupBusy, setApplySetupBusy] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [setupSaved, setSetupSaved] = useState({
    dataFolder: '',
    launchCommand: '',
    enableSwitching: true,
  });
  const [setupForm, setSetupForm] = useState(setupSaved);
  const [setupTouched, setSetupTouched] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<Profile | null>(null);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState(false);
  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);

  const [captureSaved] = useState({ alias: '', plan: 'Plus', notes: '' });
  const [captureForm, setCaptureForm] = useState(captureSaved);
  const [captureTouched, setCaptureTouched] = useState(false);
  const [addStep, setAddStep] = useState(0);
  const [loggedInStepDone, setLoggedInStepDone] = useState(false);
  const [accountSavedNotice, setAccountSavedNotice] = useState<string | null>(null);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [processStatus, setProcessStatus] = useState<CodexProcessStatus | null>(null);
  const [checkingProcess, setCheckingProcess] = useState(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const [usageSaved, setUsageSaved] = useState({
    profileId: '',
    fiveHourStatus: 'Unknown' as LimitStatus,
    weeklyStatus: 'Unknown' as LimitStatus,
    creditsStatus: 'Unknown' as LimitStatus,
    observedResetAt: '',
    notes: '',
    source: 'Manual' as Source,
  });
  const [usageForm, setUsageForm] = useState(usageSaved);
  const [usageTouched, setUsageTouched] = useState(false);
  const [usageHistory, setUsageHistory] = useState<UsageSnapshot[]>([]);

  const load = async () => {
    try {
      const [statusRes, healthRes, diagnosticsRes, settingsRes, ledgerRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/health'),
        fetch('/api/doctor'),
        fetch('/api/settings'),
        fetch('/api/ledger?limit=200'),
      ]);
      const statusData = await statusRes.json();
      const healthData = await healthRes.json();
      const diagnosticsData = await diagnosticsRes.json();
      const settingsData = await settingsRes.json();
      const ledgerData = await ledgerRes.json();

      setProfiles(statusData.profiles ?? []);
      setActiveProfileId(statusData.runtime?.activeProfileId ?? null);
      setHealth(healthData);
      setDiagnostics(diagnosticsData);
      const nextSettings = adaptSettings(settingsData);
      setSavedSettings(nextSettings);
      setLedger(ledgerData ?? []);
      setFriendlyError(null);
    } catch {
      setFriendlyError('Could not load the dashboard. Please confirm the local backend is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const parseApiError = (payload: any, fallback: string): string => {
    const fromBody = typeof payload?.error === 'string' ? payload.error : fallback;
    return fromBody.replace(/^Error:\s*/i, '').trim();
  };

  const mapAddAccountError = (raw: string, code?: AddAccountErrorCode): string => {
    if (code === 'CODEX_RUNNING' || /Codex appears to be running|codex process appears to be running/i.test(raw)) {
      return 'Codex is still open. Close Codex completely, then click Check Again.';
    }
    if (code === 'SETUP_REQUIRED' || /Local switching is disabled/i.test(raw)) {
      return 'Account switching setup is not complete. Open Advanced Settings and finish setup.';
    }
    if (code === 'DATA_FOLDER_MISSING' || /codexProfileRootPath is not configured|Configured codexProfileRootPath does not exist/i.test(raw)) {
      return 'Codex data folder was not found. Open Advanced Settings and choose the correct data folder.';
    }
    if (code === 'NO_LOGIN_DATA_FOUND' || /No Codex profile files discovered/i.test(raw)) {
      return 'Codex login data was not found. Open Codex, sign in, close Codex, then try again.';
    }
    return translateBackendError(raw.replace(/^Error:\s*/i, '').trim());
  };

  const checkCodexProcess = async () => {
    setCheckingProcess(true);
    try {
      const res = await fetch('/api/codex/process-status');
      const data = await res.json() as CodexProcessStatus;
      if (!res.ok) {
        setAddAccountError('Could not verify Codex process status. Please try again.');
        return null;
      }
      setProcessStatus(data);
      if (data.running) {
        setAddAccountError('Codex is still open. Close Codex completely, then click Check Again.');
      } else {
        setAddAccountError(null);
      }
      return data;
    } catch {
      setAddAccountError('Could not verify Codex process status. Please try again.');
      return null;
    } finally {
      setCheckingProcess(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!usageForm.profileId && profiles.length > 0 && !usageTouched) {
      setUsageForm((v) => ({ ...v, profileId: activeProfileId ?? profiles[0].id }));
    }
  }, [profiles, activeProfileId, usageForm.profileId, usageTouched]);

  useEffect(() => {
    if (!savedSettings) return;
    const nextSetupSaved = {
      dataFolder: savedSettings.dataFolder,
      launchCommand: savedSettings.appPath,
      enableSwitching: savedSettings.switchingSetupReady,
    };
    setSetupSaved(nextSetupSaved);
    if (shouldSyncDraftFromSaved({ dirty: computeDirty(setupForm, nextSetupSaved), touched: setupTouched, isOpen: setupWizardOpen })) {
      setSetupForm(nextSetupSaved);
      setSetupTouched(false);
    }
    if (shouldSyncDraftFromSaved({ dirty: computeDirty(settingsDraft, savedSettings), touched: settingsTouched, isOpen: advancedOpen })) {
      setSettingsDraft(savedSettings);
      setSettingsTouched(false);
    }
  }, [savedSettings]);

  const active = useMemo(() => profiles.find((p) => p.id === activeProfileId) ?? null, [profiles, activeProfileId]);
  const setupReady = Boolean(
    diagnostics?.setup?.codexFound
    && diagnostics?.setup?.dataFolderConfigured
    && diagnostics?.setup?.appPathConfigured
    && diagnostics?.setup?.switchingSetupComplete,
  );
  const savedCount = profiles.length;

  const openCodex = async () => {
    const res = await fetch('/api/codex/launch', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setFriendlyError(translateBackendError(data?.error ?? 'Could not open Codex.'));
      if ((data?.error ?? '').toLowerCase().includes('launch')) setSetupWizardOpen(true);
      return;
    }
    setFriendlyError(null);
    await load();
  };

  const scanForCodex = async () => {
    setScanBusy(true);
    try {
      const res = await fetch('/api/codex/discover');
      const data = await res.json() as DiscoveryResult;
      setDiscovery(data);
      setSetupSaved((v) => ({
        ...v,
        dataFolder: data.recommendedProfileRootPath ?? v.dataFolder,
        launchCommand: data.recommendedLaunchCommand ?? v.launchCommand,
      }));
      setSetupForm((v) => ({
        ...v,
        dataFolder: setupTouched ? v.dataFolder : (data.recommendedProfileRootPath ?? v.dataFolder),
        launchCommand: setupTouched ? v.launchCommand : (data.recommendedLaunchCommand ?? v.launchCommand),
      }));
      setFriendlyError(null);
    } catch {
      setFriendlyError('Could not scan for Codex right now. You can still enter setup values manually.');
    } finally {
      setScanBusy(false);
    }
  };

  const applySetup = async () => {
    setApplySetupBusy(true);
    try {
      const res = await fetch('/api/codex/setup/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codexProfileRootPath: setupForm.dataFolder || null,
          codexLaunchCommand: normalizeCodexLaunchCommand(setupForm.launchCommand) || null,
          enableSwitching: setupForm.enableSwitching,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFriendlyError(translateBackendError(data?.error ?? 'Could not save setup.'));
        return;
      }
      setSetupWizardOpen(false);
      setAdvancedOpen(false);
      setSetupTouched(false);
      setSettingsTouched(false);
      setFriendlyError(null);
      await load();
    } finally {
      setApplySetupBusy(false);
    }
  };

  const testLaunch = async (command: string) => {
    const res = await fetch('/api/codex/launch-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandOverride: normalizeCodexLaunchCommand(command) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFriendlyError(translateBackendError(data?.error ?? 'Could not test launch command.'));
      return;
    }
    setFriendlyError('Open Codex command test succeeded.');
  };

  const saveAccount = async () => {
    const status = processStatus?.running ? processStatus : await checkCodexProcess();
    if (!status || status.running) {
      return;
    }
    const res = await fetch('/api/accounts/add-current-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: captureForm.alias, plan: captureForm.plan }),
    });
    const data = await res.json();
    if (!res.ok) {
      const rawError = parseApiError(data, 'Could not save account.');
      const mapped = mapAddAccountError(rawError, data?.code);
      setAddAccountError(mapped);
      setFriendlyError(mapped);
      if (data?.code === 'CODEX_RUNNING') {
        setProcessStatus({ running: true, processes: processStatus?.processes ?? [] });
      }
      return;
    }

    const createdId = data?.profile?.id;
    if (createdId && captureForm.notes.trim()) {
      await fetch(`/api/profiles/${createdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: captureForm.notes.trim() }),
      });
    }

    setCaptureForm({ alias: '', plan: 'Plus', notes: '' });
    setCaptureTouched(false);
    setAddAccountError(null);
    setProcessStatus(null);
    setAddModalOpen(false);
    setAddStep(0);
    setLoggedInStepDone(false);
    setAccountSavedNotice('Account saved. You can now switch to it.');
    setFriendlyError(null);
    await load();
  };

  const runSafetyCheck = async (profileId: string) => {
    setSwitchBusy(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/safety-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json() as SafetyResult;
      if (!res.ok) {
        setFriendlyError('Could not run Safety Check right now. Please try again.');
        return;
      }
      setSafetyResult(data);
    } finally {
      setSwitchBusy(false);
    }
  };

  const canSwitchAccount = Boolean(selectedAccount && safetyResult?.canSwitch && switchConfirm);

  const switchAccountNow = async () => {
    if (!selectedAccount) return;
    const res = await fetch(`/api/profiles/${selectedAccount.id}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFriendlyError(translateBackendError(data?.error ?? 'Could not switch account.'));
      return;
    }
    setFriendlyError(null);
    setSwitchModalOpen(false);
    setSwitchConfirm(false);
    setSafetyResult(null);
    await load();
  };

  useEffect(() => {
    if (!switchModalOpen || !selectedAccount) return;
    void runSafetyCheck(selectedAccount.id);
  }, [switchModalOpen, selectedAccount?.id]);

  const openUsageModal = async (profileId: string) => {
    setUsageForm((s) => ({ ...s, profileId }));
    setUsageTouched(false);
    const res = await fetch(`/api/profiles/${profileId}/usage-snapshots`);
    setUsageHistory(await res.json());
    setUsageModalOpen(true);
  };

  const submitUsage = async (e: FormEvent) => {
    e.preventDefault();
    if (!usageForm.profileId) return;

    const res = await fetch(`/api/profiles/${usageForm.profileId}/usage-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiveHourStatus: usageForm.fiveHourStatus,
        weeklyStatus: usageForm.weeklyStatus,
        creditsStatus: usageForm.creditsStatus,
        observedResetAt: usageForm.observedResetAt || null,
        notes: usageForm.notes || null,
        source: usageForm.source,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setFriendlyError(translateBackendError(data?.error ?? 'Could not update usage.'));
      return;
    }

    await fetch('/api/recommendations/recompute', { method: 'POST' });
    setUsageModalOpen(false);
    setUsageTouched(false);
    await load();
  };

  const saveAdvanced = async () => {
    if (!settingsDraft) return;
    const patch = toSettingsPatch(settingsDraft);
    patch.codexLaunchCommand = normalizeCodexLaunchCommand(patch.codexLaunchCommand);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setFriendlyError(translateBackendError(data?.error ?? 'Could not save settings.'));
      return;
    }
    const adapted = adaptSettings(data);
    setSavedSettings(adapted);
    setSettingsDraft(adapted);
    setSettingsTouched(false);
    await load();
  };

  const renameAccount = async (profile: Profile) => {
    const alias = (renameDrafts[profile.id] ?? '').trim();
    if (!alias || alias === profile.alias) return;
    const res = await fetch(`/api/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    });
    if (!res.ok) {
      const data = await res.json();
      setFriendlyError(translateBackendError(data?.error ?? 'Could not rename account.'));
      return;
    }
    setRenameDrafts((m) => ({ ...m, [profile.id]: '' }));
    await load();
  };

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (switchModalOpen) {
        setSwitchModalOpen(false);
        return;
      }
      if (usageModalOpen) {
        setUsageModalOpen(false);
        return;
      }
      if (addModalOpen) {
        setAddModalOpen(false);
        return;
      }
      if (setupWizardOpen) {
        setSetupWizardOpen(false);
        return;
      }
      if (advancedOpen) {
        setAdvancedOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [advancedOpen, addModalOpen, setupWizardOpen, switchModalOpen, usageModalOpen]);

  if (loading) {
    return <div className="min-h-screen bg-[#06080B] p-6 text-zinc-100">Loading Codex Carousel…</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#102033_0%,#06080B_48%,#04060A_100%)] text-zinc-100">
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <header className={`${cardClass} mb-5 border-cyan-500/25`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Local Account Switcher</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-100">Codex Carousel V1.0</h1>
              <div className="mt-2 text-sm text-zinc-400">
                Current Account: <span className="font-medium text-zinc-100">{active?.alias ?? 'None selected'}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={`Backend: ${health?.ok ? 'Online' : 'Offline'}`} tone={health?.ok ? 'ok' : 'bad'} />
              <StatusBadge label={setupReady ? 'Setup Complete' : 'Setup Required'} tone={setupReady ? 'ok' : 'warn'} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!setupReady && <button className={buttonSecondaryClass} onClick={() => setSetupWizardOpen(true)}>Set Up Codex</button>}
            <button className={buttonPrimaryClass} onClick={() => { setAddModalOpen(true); setAdvancedOpen(false); setAddStep(0); setLoggedInStepDone(false); setAddAccountError(null); setProcessStatus(null); }}>Add Account</button>
            <button className={buttonSecondaryClass} onClick={openCodex}>Open Codex</button>
            <button className={buttonSecondaryClass} onClick={() => { setAdvancedOpen(true); setAddModalOpen(false); setSwitchModalOpen(false); setUsageModalOpen(false); }} aria-label="Advanced Settings">Advanced Settings</button>
          </div>

          {friendlyError && <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-900/20 px-4 py-2.5 text-sm text-rose-100">{friendlyError}</div>}
          {accountSavedNotice && (
            <div className="mt-4 rounded-xl border border-emerald-500/50 bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-100">
              {accountSavedNotice}
              <button className="ml-2 underline" onClick={() => setAccountSavedNotice(null)}>Dismiss</button>
            </div>
          )}
          {!setupReady && (
            <div className="mt-4 rounded-xl border border-amber-500/60 bg-amber-900/20 px-4 py-2.5 text-sm text-amber-100">
              Setup required. Connect Codex before saving accounts.
              <button className="ml-2 underline" onClick={() => setSetupWizardOpen(true)}>Set Up Codex</button>
            </div>
          )}
        </header>

        {savedCount === 0 ? (
          <section className={`${cardClass} border-zinc-700`}>
            <h2 className="text-xl font-semibold text-zinc-100">No Codex accounts saved yet</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Add your first account by opening Codex, signing in, then saving that login in the Add Account flow.</p>
            <button className={`mt-5 ${buttonPrimaryClass}`} onClick={() => { setAddModalOpen(true); setAdvancedOpen(false); setAddStep(0); setLoggedInStepDone(false); setAddAccountError(null); setProcessStatus(null); }}>Add Account</button>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-5">
              <section className={cardClass}>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Current Account</h2>
                {active ? (
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-900/35 font-semibold text-cyan-200">{active.alias[0]?.toUpperCase() ?? '?'}</div>
                      <div>
                        <div className="font-medium text-zinc-100">{active.alias}</div>
                        <div className="text-xs text-zinc-400">{active.plan}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={activeProfileId === active.id ? 'Active' : 'Ready'} tone="ok" />
                      <StatusBadge label={setupReady ? 'Ready' : 'Setup Required'} tone={setupReady ? 'ok' : 'warn'} />
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs leading-relaxed text-zinc-300">
                      <div>Observed usage: {active.fiveHourStatus} / {active.weeklyStatus} / {active.creditsStatus}</div>
                      <div className="mt-1">Recommendation: {friendlyRecommendation(active)}</div>
                      <div className="mt-1">Last used: {active.lastActivatedAt ?? 'Unknown'}</div>
                    </div>
                  </div>
                ) : <p className="text-sm text-zinc-400">Setup Required: select or save an account first.</p>}
              </section>

              <section className={cardClass}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">Recommendation</h2>
                <p className="text-sm leading-relaxed text-zinc-200">{friendlyRecommendation(active)}</p>
              </section>

              <section className={cardClass}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent Activity</h2>
                <div className="space-y-2 text-sm">
                  {ledger.slice(0, 6).map((evt) => (
                    <div key={evt.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
                      <div className="text-zinc-200">{toFriendlyActivity(evt)}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{evt.timestamp}</div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <main className="space-y-5">
              <section className={cardClass}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-zinc-200">Saved Accounts</h2>
                  <span className={chipClass}>{savedCount} accounts</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {profiles.map((p) => (
                    <article key={p.id} className={`rounded-xl border p-4 ${p.id === activeProfileId ? 'border-cyan-500/60 bg-cyan-950/25' : 'border-zinc-800 bg-zinc-900/55'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">{p.alias}</h3>
                          <p className="mt-1 text-xs text-zinc-400">{p.plan}</p>
                        </div>
                        <span className={chipClass}>{p.snapshotStatus === 'Captured' ? 'Login Saved' : 'Login Unknown'}</span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-zinc-400">
                        <div>Usage: {p.fiveHourStatus}/{p.weeklyStatus}/{p.creditsStatus}</div>
                        <div>Verification: {p.verificationStatus}</div>
                        <div>Last used: {p.lastActivatedAt ?? 'Unknown'}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-emerald-500/70 bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-900/35"
                          onClick={() => {
                            setSelectedAccount(p);
                            setSwitchConfirm(false);
                            setSafetyResult(null);
                            setSwitchModalOpen(true);
                          }}
                        >
                          Switch
                        </button>
                        <button className="rounded-lg border border-cyan-500/70 bg-cyan-900/20 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-900/35" onClick={() => openUsageModal(p.id)}>Update Usage</button>
                      </div>
                      <div className="mt-3 border-t border-zinc-800 pt-3">
                        <label className="text-xs text-zinc-400">Rename account</label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs"
                            value={renameDrafts[p.id] ?? ''}
                            onChange={(e) => setRenameDrafts((m) => ({ ...m, [p.id]: e.target.value }))}
                            placeholder="New name"
                          />
                          <button className="rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-200" onClick={() => renameAccount(p)}>Save</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </main>
          </div>
        )}
      </div>

      {setupWizardOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Set Up Codex</h3>
            <div className="mt-3 space-y-4 text-sm">
              <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="font-medium text-zinc-100">1. Find Codex</div>
                <p className="mt-1 text-zinc-400">Scan for likely Codex package and data locations on this machine.</p>
                <button className="mt-2 rounded border border-cyan-500/70 px-3 py-1.5 text-cyan-200" onClick={scanForCodex} disabled={scanBusy}>{scanBusy ? 'Scanning…' : 'Scan for Codex'}</button>
                {discovery && (
                  <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <div>Codex: {discovery.codexFound ? 'Codex found' : 'Setup required'}</div>
                    <div>Data folder: {discovery.dataFolderState === 'high' ? 'Found, high confidence' : discovery.dataFolderState === 'needs_validation' ? 'Found, needs validation' : discovery.dataFolderState === 'missing' ? 'Missing' : 'Unknown'}</div>
                    <div>Recommended data folder: {discovery.recommendedProfileRootPath ?? 'Not found'}</div>
                    <div>Recommended Open Codex command: {discovery.recommendedLaunchCommand ?? DEFAULT_CODEX_LAUNCH_COMMAND}</div>
                    {discovery.warnings.length > 0 && <div className="text-amber-200">{discovery.warnings.join(' ')}</div>}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="font-medium text-zinc-100">2. Confirm Data Folder</div>
                <label className="mt-2 block text-zinc-300">Codex data folder
                  <input className={inputClass} value={setupForm.dataFolder} onChange={(e) => { setSetupTouched(true); setSetupForm((v) => ({ ...v, dataFolder: e.target.value })); }} />
                </label>
                <p className="mt-1 text-xs text-zinc-500">This is where Codex stores local sign-in/session data. Carousel backs this up when saving accounts.</p>
              </section>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="font-medium text-zinc-100">3. Confirm Launch Command</div>
                <label className="mt-2 block text-zinc-300">Open Codex command
                  <input className={inputClass} value={setupForm.launchCommand} placeholder={DEFAULT_CODEX_LAUNCH_COMMAND} onChange={(e) => { setSetupTouched(true); setSetupForm((v) => ({ ...v, launchCommand: e.target.value })); }} />
                </label>
                <p className="mt-1 text-xs text-zinc-500">PowerShell detected AppID OpenAI.Codex_2p2nqsd0c76g0!App. Store apps launch through shell:AppsFolder.</p>
                <button className="mt-2 rounded border border-cyan-500/70 px-3 py-1.5 text-cyan-200" onClick={() => testLaunch(setupForm.launchCommand)}>Test Launch</button>
              </section>

              <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="font-medium text-zinc-100">4. Finish Setup</div>
                <label className="mt-2 flex items-center gap-2 text-zinc-300">
                  <input type="checkbox" checked={setupForm.enableSwitching} onChange={(e) => { setSetupTouched(true); setSetupForm((v) => ({ ...v, enableSwitching: e.target.checked })); }} />
                  Enable account switching after setup
                </label>
                <button className="mt-2 rounded border border-zinc-600 px-3 py-1.5 text-zinc-200" onClick={() => { setSetupForm(setupSaved); setSetupTouched(false); }}>Reset Changes</button>
              </section>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-zinc-600 px-3 py-2 text-sm" onClick={() => setSetupWizardOpen(false)}>Cancel</button>
              <button className="rounded-lg border border-emerald-400/60 bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-zinc-950" onClick={applySetup} disabled={applySetupBusy}>{applySetupBusy ? 'Saving…' : 'Save Setup'}</button>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Add Account</h3>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              {['Step 1: Open Codex', 'Step 2: Sign in', 'Step 3: Close Codex', 'Step 4: Save This Account'].map((label, idx) => (
                <div key={label} className={`rounded-lg border px-2 py-1 text-center ${addStep >= idx ? 'border-cyan-500/70 bg-cyan-900/20 text-cyan-200' : 'border-zinc-700 text-zinc-500'}`}>{label}</div>
              ))}
            </div>

            {addStep === 0 && (
              <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
                {!setupReady ? (
                  <>
                    <p className="text-amber-100">Codex setup is required before adding accounts.</p>
                    <button className="mt-3 rounded border border-amber-500/70 px-3 py-2 text-amber-200" onClick={() => { setSetupWizardOpen(true); setAddModalOpen(false); setAddAccountError(null); }}>Set Up Codex</button>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-200">Step 1: Open Codex.</p>
                    <p className="mt-2 text-zinc-300">After signing in, close Codex completely before saving this account. Carousel needs Codex closed so it can safely copy the local login files.</p>
                    <button className="mt-3 rounded border border-cyan-500/70 px-3 py-2 text-cyan-200" onClick={() => setAddStep(1)}>Open Codex Login</button>
                  </>
                )}
              </section>
            )}

            {addStep === 1 && (
              <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
                <p className="text-zinc-200">Step 2: Sign in with ChatGPT/OpenAI.</p>
                <p className="mt-2 text-zinc-300">Open Codex and complete login with the account you want to save in Carousel.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded border border-cyan-500/70 px-3 py-2 text-cyan-200" onClick={openCodex}>Open Codex Login</button>
                  <button className="rounded border border-zinc-600 px-3 py-2 text-zinc-200" onClick={() => { setLoggedInStepDone(true); setAddStep(2); }}>I Signed In</button>
                </div>
              </section>
            )}

            {addStep === 2 && (
              <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
                <p className="text-zinc-200">Step 3: Close Codex completely.</p>
                <p className="mt-2 text-zinc-300">Close all Codex windows first, then click Check Again to confirm it is no longer running.</p>
                {addAccountError && <p className="mt-2 rounded border border-rose-500/50 bg-rose-900/20 px-2 py-1.5 text-rose-100">{addAccountError}</p>}
                {processStatus?.running && processStatus.processes.length > 0 && (
                  <p className="mt-2 text-xs text-amber-200">Detected: {processStatus.processes.join(', ')}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200" onClick={() => setAddStep(1)}>Back</button>
                  <button className="rounded border border-cyan-500/70 px-3 py-2 text-sm text-cyan-200" onClick={() => void checkCodexProcess()} disabled={checkingProcess}>{checkingProcess ? 'Checking…' : 'Check Again'}</button>
                  <button className="rounded border border-emerald-500/70 px-3 py-2 text-sm text-emerald-200 disabled:opacity-50" onClick={() => setAddStep(3)} disabled={processStatus?.running !== false}>I closed Codex</button>
                </div>
              </section>
            )}

            {addStep === 3 && (
              <section className="mt-4 grid gap-3 md:grid-cols-2">
                <p className="md:col-span-2 text-sm text-zinc-300">Step 4: Save This Account.</p>
                <label className="text-sm text-zinc-300">Account Name
                  <input className={inputClass} value={captureForm.alias} onChange={(e) => { setCaptureTouched(true); setCaptureForm((v) => ({ ...v, alias: e.target.value })); }} />
                </label>
                <label className="text-sm text-zinc-300">Plan
                  <select className={inputClass} value={captureForm.plan} onChange={(e) => { setCaptureTouched(true); setCaptureForm((v) => ({ ...v, plan: e.target.value })); }}>
                    <option value="Plus">Plus</option>
                    <option value="Pro100">Pro 100</option>
                    <option value="Pro200">Pro 200</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-sm text-zinc-300">Notes (optional)
                  <input className={inputClass} value={captureForm.notes} onChange={(e) => { setCaptureTouched(true); setCaptureForm((v) => ({ ...v, notes: e.target.value })); }} />
                </label>
                <button className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200 md:col-span-2" onClick={() => { setCaptureForm(captureSaved); setCaptureTouched(false); }}>Reset Changes</button>
                {addAccountError && <p className="mt-2 rounded border border-rose-500/50 bg-rose-900/20 px-2 py-1.5 text-rose-100">{addAccountError}</p>}
                <div className="mt-3 flex flex-wrap gap-2 md:col-span-2">
                  <button className="rounded border border-zinc-600 px-3 py-2 text-sm" onClick={() => setAddStep(2)}>Back</button>
                  <button className="rounded border border-cyan-500/70 px-3 py-2 text-sm text-cyan-200" onClick={() => void checkCodexProcess()} disabled={checkingProcess}>{checkingProcess ? 'Checking…' : 'Check Again'}</button>
                  <button className="rounded border border-emerald-400/60 bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50" onClick={saveAccount} disabled={!captureForm.alias.trim() || !loggedInStepDone || processStatus?.running !== false}>Save This Account</button>
                </div>
              </section>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="rounded-lg border border-zinc-600 px-3 py-2 text-sm" onClick={() => { setAddModalOpen(false); setAddStep(0); setAddAccountError(null); setProcessStatus(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {switchModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Switch Account</h3>
            <p className="mt-1 text-sm text-zinc-300">Target account: <span className="font-medium text-zinc-100">{selectedAccount.alias}</span></p>
            <p className="mt-2 text-sm text-zinc-300">Codex Carousel will back up the current account and switch to <span className="font-medium text-zinc-100">{selectedAccount.alias}</span>. Close Codex before continuing.</p>

            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              {(safetyResult?.checks ?? []).map((check) => (
                <div key={check.label} className="mt-1 first:mt-0">
                  {check.label}: <span className="text-zinc-200">{check.label === 'Codex status' && check.status === 'Ready' ? 'Closed' : check.label === 'Setup' && check.status === 'Ready' ? 'Complete' : check.label === 'Setup' && check.status === 'Warning' ? 'Required' : check.label === 'Result' && check.status === 'Ready' ? 'Safe to switch' : check.label === 'Result' ? 'Fix setup first' : check.status}</span>
                </div>
              ))}
              {(!safetyResult || safetyResult.checks.length === 0) && <div>Run Safety Check to verify switching safety.</div>}
              {safetyResult?.warnings?.map((warning, idx) => (
                <div key={`${warning}-${idx}`} className="mt-1 text-xs text-zinc-400">{warning}</div>
              ))}
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={switchConfirm} onChange={(e) => setSwitchConfirm(e.target.checked)} />
              I understand Codex should be closed before switching.
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="rounded-lg border border-zinc-600 px-3 py-2 text-sm" onClick={() => setSwitchModalOpen(false)}>Cancel</button>
              <button className="rounded-lg border border-cyan-500/70 px-3 py-2 text-sm text-cyan-200" onClick={() => runSafetyCheck(selectedAccount.id)} disabled={switchBusy}>{switchBusy ? 'Running…' : 'Safety Check'}</button>
              <button className="rounded-lg border border-emerald-400/60 bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canSwitchAccount} onClick={switchAccountNow}>Switch Account</button>
            </div>
          </div>
        </div>
      )}

      {usageModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Update Usage</h3>
            <form onSubmit={submitUsage} className="mt-3 grid gap-3 text-sm">
              <label className="text-zinc-300">Profile
                <select className={inputClass} value={usageForm.profileId} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, profileId: e.target.value })); }}>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.alias}</option>)}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-zinc-300">5H window status
                  <select className={inputClass} value={usageForm.fiveHourStatus} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, fiveHourStatus: e.target.value as LimitStatus })); }}>
                    <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
                  </select>
                </label>
                <label className="text-zinc-300">weekly/plan status
                  <select className={inputClass} value={usageForm.weeklyStatus} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, weeklyStatus: e.target.value as LimitStatus })); }}>
                    <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
                  </select>
                </label>
                <label className="text-zinc-300">credits status
                  <select className={inputClass} value={usageForm.creditsStatus} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, creditsStatus: e.target.value as LimitStatus })); }}>
                    <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
                  </select>
                </label>
              </div>
              <label className="text-zinc-300">reset time
                <input className={inputClass} value={usageForm.observedResetAt} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, observedResetAt: e.target.value })); }} placeholder="2026-04-27T00:00:00.000Z" />
              </label>
              <label className="text-zinc-300">note
                <input className={inputClass} value={usageForm.notes} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, notes: e.target.value })); }} />
              </label>
              <label className="text-zinc-300">source
                <select className={inputClass} value={usageForm.source} onChange={(e) => { setUsageTouched(true); setUsageForm((v) => ({ ...v, source: e.target.value as Source })); }}>
                  <option>Manual</option><option>CodexBanner</option><option>UsageDashboard</option><option>Unknown</option>
                </select>
              </label>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
                Latest saved snapshots: {usageHistory.length}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-lg border border-zinc-600 px-3 py-2" onClick={() => { setUsageForm(usageSaved); setUsageTouched(false); }}>Reset Changes</button>
                <button type="button" className="rounded-lg border border-zinc-600 px-3 py-2" onClick={() => setUsageModalOpen(false)}>Cancel</button>
                <button className="rounded-lg border border-cyan-500/70 px-3 py-2 text-cyan-200">Save Usage Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {advancedOpen && settingsDraft && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">Advanced Settings</h3>
            <button className="rounded border border-zinc-600 px-2 py-1 text-sm" onClick={() => setAdvancedOpen(false)}>Close</button>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="font-medium text-zinc-100">Switching setup</div>
              <div className="mt-1 text-zinc-300">{setupReady ? 'Setup Complete' : 'Setup Required'}</div>
            </div>

            <label className="block text-zinc-300">Codex data folder
              <input className={inputClass} value={settingsDraft.dataFolder} onChange={(e) => { setSettingsTouched(true); setSettingsDraft((s) => s ? { ...s, dataFolder: e.target.value } : s); }} />
            </label>
            <label className="block text-zinc-300">Open Codex command
              <input className={inputClass} value={settingsDraft.appPath} placeholder={DEFAULT_CODEX_LAUNCH_COMMAND} onChange={(e) => { setSettingsTouched(true); setSettingsDraft((s) => s ? { ...s, appPath: e.target.value } : s); }} />
            </label>
            <p className="text-xs text-zinc-500">PowerShell detected AppID OpenAI.Codex_2p2nqsd0c76g0!App. Store apps launch through shell:AppsFolder.</p>
            <button className="w-full rounded-lg border border-cyan-500/70 px-3 py-2 text-cyan-200" onClick={() => testLaunch(settingsDraft.appPath)}>Test Launch</button>
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" checked={settingsDraft.requireClosedBeforeSwitch} onChange={(e) => { setSettingsTouched(true); setSettingsDraft((s) => s ? { ...s, requireClosedBeforeSwitch: e.target.checked } : s); }} />
              Require Codex closed before switch
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" checked={settingsDraft.openAfterSwitch} onChange={(e) => { setSettingsTouched(true); setSettingsDraft((s) => s ? { ...s, openAfterSwitch: e.target.checked } : s); }} />
              Auto launch after switch
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" checked={settingsDraft.switchingSetupReady} onChange={(e) => { setSettingsTouched(true); setSettingsDraft((s) => s ? { ...s, switchingSetupReady: e.target.checked } : s); }} />
              Account switching setup
            </label>

            <button className="w-full rounded-lg border border-emerald-500/70 bg-emerald-900/20 px-3 py-2 text-emerald-200" onClick={saveAdvanced}>Save Advanced Settings</button>
            <button className="w-full rounded-lg border border-zinc-600 px-3 py-2 text-zinc-200" onClick={() => { setSettingsDraft(savedSettings); setSettingsTouched(false); }}>Reset Changes</button>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="font-medium text-zinc-100">Diagnostics</div>
              <div className="mt-1 text-zinc-300">Status: {diagnostics?.status ?? 'Unknown'}</div>
              {diagnostics?.setup && (
                <div className="mt-2 space-y-1 text-xs text-zinc-400">
                  <div>Codex found: {diagnostics.setup.codexFound ? 'Yes' : 'No'}</div>
                  <div>Codex data folder configured: {diagnostics.setup.dataFolderConfigured ? 'Yes' : 'No'}</div>
                  <div>Open Codex command configured: {diagnostics.setup.appPathConfigured ? 'Yes' : 'No'}</div>
                  <div>Account switching setup complete: {diagnostics.setup.switchingSetupComplete ? 'Yes' : 'No'}</div>
                </div>
              )}
              {diagnostics?.issues?.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-amber-200">
                  {diagnostics.issues.map((issue) => <li key={issue}>{translateBackendError(issue)}</li>)}
                </ul>
              ) : <div className="mt-1 text-xs text-zinc-400">No diagnostics warnings detected.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="font-medium text-zinc-100">Event log</div>
              <div className="mt-2 max-h-56 overflow-auto space-y-1 text-xs text-zinc-300 custom-scrollbar">
                {ledger.map((evt) => (
                  <div key={evt.id} className="rounded border border-zinc-800 bg-zinc-950/80 p-2">
                    <div className="text-zinc-200">{evt.eventType}</div>
                    <div className="text-zinc-500">{evt.timestamp}</div>
                    <div>{evt.message}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="w-full rounded-lg border border-rose-500/70 bg-rose-900/20 px-3 py-2 text-rose-200"
              onClick={() => setFriendlyError('Reset setup is not yet available in the API. Configure fields manually for now.')}
            >
              Reset setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
