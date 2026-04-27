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
};

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
  const [switchDryRun, setSwitchDryRun] = useState<any | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState(false);

  const [captureForm, setCaptureForm] = useState({ alias: '', plan: 'Plus' });

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
      const [res, healthRes, doctorRes, settingsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/health'),
        fetch('/api/doctor'),
        fetch('/api/settings'),
      ]);
      const data = await res.json();
      const healthData = await healthRes.json();
      const doctorData = await doctorRes.json();
      const settingsData = await settingsRes.json();
      setProfiles(data.profiles ?? []);
      setActiveProfileId(data.runtime?.activeProfileId ?? null);
      setLedger(data.ledger ?? []);
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
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(() => profiles.find((p) => p.id === activeProfileId) ?? null, [profiles, activeProfileId]);

  const saveSettings = async (patch: Partial<Settings>) => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const submitUsage = async (e: FormEvent) => {
    e.preventDefault();
    if (!usageForm.profileId) return;
    await fetch(`/api/profiles/${usageForm.profileId}/usage-snapshots`, {
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
    await fetch('/api/recommendations/recompute', { method: 'POST' });
    await load();
  };

  const captureCurrent = async () => {
    await fetch('/api/profiles/capture-current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureForm),
    });
    await load();
  };

  const runSwitchDryRun = async (targetProfileId: string) => {
    setSwitchLoading(true);
    try {
      const res = await fetch(`/api/profiles/${targetProfileId}/switch/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSwitchDryRun(data);
      if (!res.ok) setError(data?.error ?? 'Dry-run failed');
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
    if (!res.ok) setError(data?.error ?? 'Switch failed');
    else setError(null);
    await load();
  };

  const launchCodex = async () => {
    const res = await fetch('/api/codex/launch', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) setError(data?.error ?? 'Launch failed');
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl mb-4">Codex Carousel</h1>
      {error && <div className="text-red-400 mb-4">{error}</div>}

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Local Switching Settings</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="col-span-2">
            <input
              type="checkbox"
              checked={settings?.localSwitchingEnabled ?? false}
              onChange={(e) => saveSettings({ localSwitchingEnabled: e.target.checked })}
            />{' '}
            Local Switching Enabled
          </label>
          <label>Codex profile root path
            <input className="block bg-black border border-gray-600 w-full" value={settings?.codexProfileRootPath ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexProfileRootPath: e.target.value } : s)} />
          </label>
          <label>Codex launch command
            <input className="block bg-black border border-gray-600 w-full" value={settings?.codexLaunchCommand ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexLaunchCommand: e.target.value } : s)} />
          </label>
          <button className="px-3 py-1 border border-blue-500 col-span-2" onClick={() => saveSettings({ codexProfileRootPath: settings?.codexProfileRootPath ?? null, codexLaunchCommand: settings?.codexLaunchCommand ?? null })}>Save Settings</button>
        </div>
        <button className="mt-3 px-3 py-1 border border-green-500" onClick={launchCodex}>Launch Codex</button>
      </section>

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Capture Current Login</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Alias
            <input className="block bg-black border border-gray-600 w-full" value={captureForm.alias} onChange={(e) => setCaptureForm((v) => ({ ...v, alias: e.target.value }))} />
          </label>
          <label>Plan
            <select className="block bg-black border border-gray-600 w-full" value={captureForm.plan} onChange={(e) => setCaptureForm((v) => ({ ...v, plan: e.target.value }))}>
              <option>Plus</option><option>Pro100</option><option>Pro200</option><option>Unknown</option>
            </select>
          </label>
          <button className="px-3 py-1 border border-green-600 col-span-2" onClick={captureCurrent}>Capture Current Login</button>
        </div>
      </section>

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Backend Connection Status</h2>
        <div className="text-sm">
          <div><strong>API Reachable:</strong> {health?.ok ? 'Yes' : 'No'}</div>
          <div><strong>Storage Status:</strong> {health?.storageStatus ?? 'Unknown'}</div>
          <div><strong>Last Event:</strong> {health?.lastEventTimestamp ?? 'Unknown'}</div>
        </div>
        {doctor && doctor.status !== 'healthy' && (
          <div className="mt-3 text-yellow-300">
            <strong>Doctor Warnings:</strong>
            <ul className="list-disc list-inside">{doctor.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Active Codex Profile</h2>
        {active ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Alias:</strong> {active.alias}</div>
            <div><strong>Plan:</strong> {active.plan}</div>
            <div><strong>Verification Status:</strong> {active.verificationStatus}</div>
            <div><strong>5H Window Status:</strong> {active.fiveHourStatus}</div>
            <div><strong>Weekly/Plan Status:</strong> {active.weeklyStatus}</div>
            <div><strong>Credits Status:</strong> {active.creditsStatus}</div>
            <div><strong>Reset / Next Safe Use:</strong> {active.observedResetAt ?? 'Unknown'}</div>
            <div><strong>Last Usage Snapshot:</strong> {active.lastActivatedAt ?? 'Unknown'}</div>
            <div className="col-span-2"><strong>Recommendation:</strong> {active.recommendation} — {active.recommendationReason ?? 'Unknown'}</div>
          </div>
        ) : <div>Unknown</div>}
        {active?.verificationStatus === 'VerifyUnavailable' && <div className="text-yellow-300 mt-2">Local profile restored, identity not verified</div>}
      </section>

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Profiles</h2>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="border border-gray-800 p-2 flex items-center justify-between">
              <div>
                <div>{p.alias} ({p.plan})</div>
                <div className="text-xs text-gray-400">Verification: {p.verificationStatus}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-blue-600" onClick={() => runSwitchDryRun(p.id)}>Dry Run</button>
                <button className="px-3 py-1 border border-green-600" onClick={() => { setSwitchTarget(p); setSwitchDryRun(null); setSwitchConfirm(false); }}>Switch Profile</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {switchTarget && (
        <section className="mb-6 border border-yellow-600 p-4">
          <h2 className="font-bold mb-2">Switch Profile Confirmation</h2>
          <div className="text-sm">
            <div><strong>Source active profile:</strong> {active?.alias ?? 'None'}</div>
            <div><strong>Target profile:</strong> {switchTarget.alias}</div>
          </div>
          <button className="mt-2 px-3 py-1 border border-blue-500" onClick={() => runSwitchDryRun(switchTarget.id)} disabled={switchLoading}>{switchLoading ? 'Running Dry Run...' : 'Dry Run'}</button>
          {switchDryRun && (
            <div className="mt-2 text-sm">
              <div><strong>Verification status:</strong> {switchDryRun.verification?.targetProfile ?? 'Unknown'}</div>
              <div><strong>Files that would be backed up:</strong> {(switchDryRun.backupPlan ?? []).length}</div>
              <div><strong>Files that would be restored:</strong> {(switchDryRun.restorePlan ?? []).length}</div>
              <div><strong>Warnings:</strong> {(switchDryRun.warnings ?? []).join(' | ') || 'None'}</div>
              <div><strong>Dry-run result:</strong> {switchDryRun.dryRun ? 'Completed' : 'Failed'}</div>
            </div>
          )}
          <label className="block mt-3">
            <input type="checkbox" checked={switchConfirm} onChange={(e) => setSwitchConfirm(e.target.checked)} /> Confirm real switch
          </label>
          <button className="mt-2 px-3 py-1 border border-red-500" onClick={runRealSwitch} disabled={!switchConfirm}>Switch Profile</button>
        </section>
      )}

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Manual Usage Snapshot</h2>
        <form onSubmit={submitUsage} className="grid grid-cols-2 gap-2 text-sm">
          <label>Profile
            <select className="block bg-black border border-gray-600 w-full" value={usageForm.profileId} onChange={(e) => setUsageForm((s) => ({ ...s, profileId: e.target.value }))}>
              <option value="">Select</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.alias}</option>)}
            </select>
          </label>
          <label>Source
            <select className="block bg-black border border-gray-600 w-full" value={usageForm.source} onChange={(e) => setUsageForm((s) => ({ ...s, source: e.target.value as Source }))}>
              <option>Manual</option><option>CodexBanner</option><option>UsageDashboard</option><option>Unknown</option>
            </select>
          </label>
          <button className="px-3 py-1 border border-blue-500 col-span-2">Save Usage Snapshot</button>
        </form>
      </section>

      <section className="border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Event Ledger / Switch History / Rollback Status</h2>
        <div className="max-h-64 overflow-auto text-xs space-y-1">
          {ledger.map((evt) => (
            <div key={evt.id} className="border-b border-gray-800 pb-1">
              <strong>{evt.eventType}</strong> [{evt.severity}] — {evt.message}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
