/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';

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

type Settings = {
  activeProfileId: string | null;
  localSwitchingEnabled: boolean;
  codexProfileRootPath: string | null;
  codexLaunchCommand: string | null;
  requireCodexClosedBeforeSwitch: boolean;
  autoLaunchAfterSwitch: boolean;
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

type DryRunResult = {
  dryRun: boolean;
  targetProfileId: string;
  backupPlan?: unknown[];
  restorePlan?: unknown[];
  warnings?: string[];
};

const statusTone = (value: string) => {
  if (value.toLowerCase().includes('exhausted') || value.toLowerCase().includes('failed')) return 'text-red-300 border-red-500/50';
  if (value.toLowerCase().includes('low') || value.toLowerCase().includes('degraded') || value.toLowerCase().includes('warning')) return 'text-yellow-300 border-yellow-500/50';
  if (value.toLowerCase().includes('available') || value.toLowerCase().includes('healthy') || value.toLowerCase().includes('verified') || value.toLowerCase() === 'ok') return 'text-green-300 border-green-500/50';
  return 'text-zinc-300 border-zinc-600/50';
};

const cardClass = 'rounded-md border border-zinc-800 bg-zinc-950/95 p-4 shadow-[0_0_0_1px_rgba(63,63,70,.2)]';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [doctor, setDoctor] = useState<{ status: string; issues: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<Profile | null>(null);
  const [switchDryRun, setSwitchDryRun] = useState<DryRunResult | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [captureForm, setCaptureForm] = useState({ alias: '', plan: 'Plus' });
  const [usageModalData, setUsageModalData] = useState<UsageSnapshot[]>([]);

  const [usageForm, setUsageForm] = useState({
    profileId: '',
    fiveHourStatus: 'Unknown' as LimitStatus,
    weeklyStatus: 'Unknown' as LimitStatus,
    creditsStatus: 'Unknown' as LimitStatus,
    observedResetAt: '',
    lastLimitBanner: '',
    notes: '',
    source: 'Manual' as Source,
  });

  const load = async () => {
    try {
      const [statusRes, healthRes, doctorRes, settingsRes, ledgerRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/health'),
        fetch('/api/doctor'),
        fetch('/api/settings'),
        fetch('/api/ledger'),
      ]);
      const statusData = await statusRes.json();
      const healthData = await healthRes.json();
      const doctorData = await doctorRes.json();
      const settingsData = await settingsRes.json();
      const ledgerData = await ledgerRes.json();
      setProfiles(statusData.profiles ?? []);
      setActiveProfileId(statusData.runtime?.activeProfileId ?? null);
      setLedger(ledgerData ?? statusData.ledger ?? []);
      setHealth(healthData);
      setDoctor(doctorData);
      setSettings(settingsData);
      setError(null);
    } catch {
      setError('Failed to load backend status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!usageForm.profileId && profiles.length > 0) {
      setUsageForm((current) => ({ ...current, profileId: activeProfileId ?? profiles[0].id }));
    }
  }, [profiles, activeProfileId, usageForm.profileId]);

  const active = useMemo(() => profiles.find((p) => p.id === activeProfileId) ?? null, [profiles, activeProfileId]);
  const lastSnapshot = usageModalData[0] ?? null;
  const dryRunPassed = Boolean(switchDryRun?.dryRun);
  const canRunRealSwitch = Boolean(switchTarget && dryRunPassed && switchConfirm && settings?.localSwitchingEnabled);

  const saveSettings = async (patch: Partial<Settings>) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? 'Failed to save settings');
      return;
    }
    setSettings(data);
    await load();
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
        lastLimitBanner: usageForm.lastLimitBanner || null,
        notes: usageForm.notes || null,
        source: usageForm.source,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? 'Save usage snapshot failed');
      return;
    }

    await fetch('/api/recommendations/recompute', { method: 'POST' });
    const snapshotsRes = await fetch(`/api/profiles/${usageForm.profileId}/usage-snapshots`);
    setUsageModalData(await snapshotsRes.json());
    await load();
  };

  const openUsageSnapshots = async (profileId: string) => {
    setUsageForm((v) => ({ ...v, profileId }));
    const res = await fetch(`/api/profiles/${profileId}/usage-snapshots`);
    const data = await res.json();
    setUsageModalData(data ?? []);
  };

  const captureCurrent = async () => {
    const res = await fetch('/api/profiles/capture-current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? 'Capture failed');
      return;
    }
    setCaptureForm({ alias: '', plan: 'Plus' });
    await load();
  };

  const selectSwitchTarget = (profile: Profile) => {
    setSwitchTarget(profile);
    setSwitchDryRun(null);
    setSwitchConfirm(false);
    setSwitchError(null);
  };

  const runSwitchDryRun = async (targetProfileId: string) => {
    setSwitchLoading(true);
    setSwitchError(null);
    try {
      const res = await fetch(`/api/profiles/${targetProfileId}/switch/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSwitchDryRun(data);
      if (!res.ok) setSwitchError(data?.error ?? 'Dry-run failed');
    } finally {
      setSwitchLoading(false);
    }
  };

  const runRealSwitch = async () => {
    if (!switchTarget) return;
    const res = await fetch(`/api/profiles/${switchTarget.id}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: switchConfirm }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSwitchError(data?.error ?? 'Switch failed');
      await load();
      return;
    }
    setSwitchError(null);
    await load();
  };

  const launchCodex = async () => {
    const res = await fetch('/api/codex/launch', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) setError(data?.error ?? 'Launch failed');
    else setError(null);
  };

  if (loading) return <div className="min-h-screen bg-black p-6 text-zinc-100">Booting operator console...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className={`${cardClass} mb-4 border-green-500/25`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-wide text-green-300">Codex Carousel V1.0</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`rounded border px-2 py-1 ${statusTone(health?.ok ? 'healthy' : 'failed')}`}>Backend: {health?.ok ? 'Online' : 'Offline'}</span>
              <span className={`rounded border px-2 py-1 ${statusTone(health?.storageStatus ?? 'Unknown')}`}>Storage: {health?.storageStatus ?? 'Unknown'}</span>
              <span className={`rounded border px-2 py-1 ${statusTone(settings?.localSwitchingEnabled ? 'verified' : 'warning')}`}>Local switching: {settings?.localSwitchingEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          {error && <div className="mt-3 rounded border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>}
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.7fr]">
          <aside className="space-y-4">
            <section className={cardClass}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Active Profile Card</h2>
              {active ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium text-green-300">{active.alias} · {active.plan}</div>
                  <div className="text-xs text-zinc-400">ID: {active.id}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className={`rounded border px-2 py-1 ${statusTone(active.fiveHourStatus)}`}>5H: {active.fiveHourStatus}</span>
                    <span className={`rounded border px-2 py-1 ${statusTone(active.weeklyStatus)}`}>Weekly: {active.weeklyStatus}</span>
                    <span className={`rounded border px-2 py-1 ${statusTone(active.creditsStatus)}`}>Credits: {active.creditsStatus}</span>
                    <span className={`rounded border px-2 py-1 ${statusTone(active.verificationStatus)}`}>Verify: {active.verificationStatus}</span>
                  </div>
                  <div className="text-xs text-zinc-300">Last activated: {active.lastActivatedAt ?? 'Unknown'}</div>
                </div>
              ) : <div className="text-sm text-zinc-400">Unknown (no active profile selected).</div>}
            </section>

            <section className={cardClass}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Recommendation</h2>
              <div className="text-sm text-green-200">{active?.recommendation ?? 'Unknown'}</div>
              <div className="mt-1 text-xs text-zinc-400">{active?.recommendationReason ?? 'No recommendation because usage status is unknown'}</div>
            </section>

            <section className={cardClass}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Usage Snapshot</h2>
              <div className="space-y-2 text-xs">
                <label className="block text-zinc-300">Profile
                  <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm.profileId} onChange={(e) => openUsageSnapshots(e.target.value)}>
                    <option value="">Select profile</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.alias}</option>)}
                  </select>
                </label>
                <div className="rounded border border-zinc-800 bg-zinc-900/70 p-2">
                  <div className="text-zinc-400">Latest observed:</div>
                  {lastSnapshot ? (
                    <div className="mt-1 space-y-1 text-zinc-200">
                      <div>{lastSnapshot.fiveHourStatus}/{lastSnapshot.weeklyStatus}/{lastSnapshot.creditsStatus}</div>
                      <div>Source: {lastSnapshot.source}</div>
                      <div>Reset: {lastSnapshot.observedResetAt ?? 'Unknown'}</div>
                    </div>
                  ) : <div className="mt-1 text-zinc-400">Unknown</div>}
                </div>
                <form onSubmit={submitUsage} className="grid grid-cols-2 gap-2">
                  {(['fiveHourStatus', 'weeklyStatus', 'creditsStatus'] as const).map((field) => (
                    <label key={field} className="block text-zinc-300">
                      {field === 'fiveHourStatus' ? 'fiveHourStatus' : field === 'weeklyStatus' ? 'weeklyStatus' : 'creditsStatus'}
                      <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm[field]} onChange={(e) => setUsageForm((s) => ({ ...s, [field]: e.target.value as LimitStatus }))}>
                        <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
                      </select>
                    </label>
                  ))}
                  <label className="col-span-2 block text-zinc-300">observedResetAt
                    <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm.observedResetAt} onChange={(e) => setUsageForm((s) => ({ ...s, observedResetAt: e.target.value }))} placeholder="2026-04-27T00:00:00.000Z" />
                  </label>
                  <label className="col-span-2 block text-zinc-300">lastLimitBanner
                    <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm.lastLimitBanner} onChange={(e) => setUsageForm((s) => ({ ...s, lastLimitBanner: e.target.value }))} />
                  </label>
                  <label className="col-span-2 block text-zinc-300">notes
                    <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm.notes} onChange={(e) => setUsageForm((s) => ({ ...s, notes: e.target.value }))} />
                  </label>
                  <label className="col-span-2 block text-zinc-300">source
                    <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={usageForm.source} onChange={(e) => setUsageForm((s) => ({ ...s, source: e.target.value as Source }))}>
                      <option>Manual</option><option>CodexBanner</option><option>UsageDashboard</option><option>Unknown</option>
                    </select>
                  </label>
                  <button className="col-span-2 rounded border border-cyan-500/70 bg-cyan-950/20 px-3 py-2 text-sm font-medium text-cyan-200">Save Usage Snapshot</button>
                </form>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Settings</h2>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings?.localSwitchingEnabled ?? false} onChange={(e) => setSettings((s) => s ? { ...s, localSwitchingEnabled: e.target.checked } : s)} />
                  localSwitchingEnabled
                </label>
                <label className="block">codexProfileRootPath
                  <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={settings?.codexProfileRootPath ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexProfileRootPath: e.target.value } : s)} />
                </label>
                <label className="block">codexLaunchCommand
                  <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={settings?.codexLaunchCommand ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexLaunchCommand: e.target.value } : s)} />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={settings?.requireCodexClosedBeforeSwitch ?? true} onChange={(e) => setSettings((s) => s ? { ...s, requireCodexClosedBeforeSwitch: e.target.checked } : s)} /> requireCodexClosedBeforeSwitch</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={settings?.autoLaunchAfterSwitch ?? false} onChange={(e) => setSettings((s) => s ? { ...s, autoLaunchAfterSwitch: e.target.checked } : s)} /> autoLaunchAfterSwitch</label>
                {settings?.localSwitchingEnabled && !settings.codexProfileRootPath && (
                  <div className="rounded border border-yellow-500/60 bg-yellow-950/20 p-2 text-yellow-200">Warning: local switching is enabled but codexProfileRootPath is missing.</div>
                )}
                <button className="w-full rounded border border-green-500/70 bg-green-950/20 px-3 py-2 text-sm text-green-200" onClick={() => saveSettings({
                  localSwitchingEnabled: settings?.localSwitchingEnabled ?? false,
                  codexProfileRootPath: settings?.codexProfileRootPath ?? null,
                  codexLaunchCommand: settings?.codexLaunchCommand ?? null,
                  requireCodexClosedBeforeSwitch: settings?.requireCodexClosedBeforeSwitch ?? true,
                  autoLaunchAfterSwitch: settings?.autoLaunchAfterSwitch ?? false,
                })}>Save Settings</button>
              </div>
            </section>
          </aside>

          <main className="space-y-4">
            <section className={cardClass}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Profile Table</h2>
                <div className="text-xs text-zinc-500">Profiles: {health?.profileCount ?? profiles.length}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-zinc-400">
                    <tr className="border-b border-zinc-800">
                      <th className="px-2 py-2">Alias</th><th className="px-2 py-2">Plan</th><th className="px-2 py-2">Usage</th><th className="px-2 py-2">Verification</th><th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className={`border-b border-zinc-900 ${switchTarget?.id === p.id ? 'bg-green-950/20' : ''}`}>
                        <td className="px-2 py-2">{p.alias}{activeProfileId === p.id && <span className="ml-2 rounded border border-green-500/70 px-1 text-[10px] text-green-300">ACTIVE</span>}</td>
                        <td className="px-2 py-2">{p.plan}</td>
                        <td className="px-2 py-2">{p.fiveHourStatus}/{p.weeklyStatus}/{p.creditsStatus}</td>
                        <td className="px-2 py-2">{p.verificationStatus}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button className="rounded border border-blue-500/70 px-2 py-1 text-blue-200" onClick={() => { selectSwitchTarget(p); runSwitchDryRun(p.id); }}>Dry Run</button>
                            <button className="rounded border border-green-500/70 px-2 py-1 text-green-200" onClick={() => selectSwitchTarget(p)}>Switch Profile</button>
                            <button className="rounded border border-zinc-600 px-2 py-1 text-zinc-200" onClick={() => openUsageSnapshots(p.id)}>Usage</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Switch / Capture Controls</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-xs">
                  <div className="font-medium text-zinc-300">Capture Current Login</div>
                  <label className="block">Alias
                    <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={captureForm.alias} onChange={(e) => setCaptureForm((v) => ({ ...v, alias: e.target.value }))} />
                  </label>
                  <label className="block">Plan
                    <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={captureForm.plan} onChange={(e) => setCaptureForm((v) => ({ ...v, plan: e.target.value }))}>
                      <option>Plus</option><option>Pro100</option><option>Pro200</option><option>Unknown</option>
                    </select>
                  </label>
                  <button className="rounded border border-green-500/70 bg-green-950/20 px-3 py-2 text-green-200" onClick={captureCurrent}>Capture Current Login</button>
                </div>

                <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
                  <div className="font-medium text-zinc-200">Switch Panel {switchTarget ? `· ${switchTarget.alias}` : ''}</div>
                  <div className="text-zinc-400">Select a profile, run dry-run, review warnings, then confirm real switch.</div>
                  <button className="rounded border border-cyan-500/70 px-3 py-2 text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => switchTarget && runSwitchDryRun(switchTarget.id)} disabled={!switchTarget || switchLoading}>{switchLoading ? 'Running...' : 'Dry Run'}</button>
                  {switchDryRun && (
                    <div className="rounded border border-zinc-700 p-2">
                      <div>Dry-run: {switchDryRun.dryRun ? 'Succeeded' : 'Failed'}</div>
                      <div>Backup entries: {switchDryRun.backupPlan?.length ?? 0}</div>
                      <div>Restore entries: {switchDryRun.restorePlan?.length ?? 0}</div>
                      <div>Warnings: {(switchDryRun.warnings?.join(' | ') || 'None')}</div>
                    </div>
                  )}
                  {switchError && <div className="rounded border border-red-500/50 bg-red-950/20 p-2 text-red-200">{switchError}</div>}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={switchConfirm} onChange={(e) => setSwitchConfirm(e.target.checked)} /> Confirm real switch</label>
                  <button className="rounded border border-red-500/70 bg-red-950/20 px-3 py-2 text-red-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canRunRealSwitch} onClick={runRealSwitch}>Switch Profile</button>
                  {!settings?.localSwitchingEnabled && <div className="text-yellow-300">Local switching disabled in settings.</div>}
                </div>
              </div>
              <button className="mt-4 rounded border border-purple-500/70 bg-purple-950/20 px-3 py-2 text-purple-200" onClick={launchCodex}>Launch Codex</button>
            </section>

            <section className={cardClass}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Event Ledger</h2>
              <div className="max-h-80 overflow-auto text-xs custom-scrollbar">
                {ledger.map((evt) => (
                  <div key={evt.id} className="mb-1 rounded border border-zinc-900 bg-zinc-900/80 p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200">{evt.eventType}</span>
                      <span className={`rounded border px-1 py-0.5 text-[10px] ${statusTone(evt.severity)}`}>{evt.severity}</span>
                    </div>
                    <div className="text-zinc-400">{evt.timestamp}</div>
                    <div className="text-zinc-200">{evt.message}</div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>

        <footer className={`${cardClass} mt-4`}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Doctor / Safety Status</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded border px-2 py-1 ${statusTone(doctor?.status ?? 'Unknown')}`}>Doctor: {doctor?.status ?? 'Unknown'}</span>
            <span className={`rounded border px-2 py-1 ${statusTone(settings?.localSwitchingEnabled ? 'warning' : 'healthy')}`}>Safety gate: {settings?.localSwitchingEnabled ? 'Real switch enabled' : 'Real switch disabled by default'}</span>
          </div>
          {doctor?.issues?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-yellow-200">
              {doctor.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : <div className="mt-2 text-sm text-zinc-400">No doctor warnings detected.</div>}
        </footer>
      </div>
    </div>
  );
}
