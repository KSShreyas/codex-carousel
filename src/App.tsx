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

const STATE_LABELS = ['Unknown', 'Observed', 'Verified', 'Unverified', 'Failed', 'Dry-run only', 'Local switching disabled', 'Switch requires confirmation'];

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
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageModalData, setUsageModalData] = useState<UsageSnapshot[]>([]);

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

  const openUsageModal = async () => {
    if (!activeProfileId) return;
    const res = await fetch(`/api/profiles/${activeProfileId}/usage-snapshots`);
    const data = await res.json();
    setUsageModalData(data ?? []);
    setUsageModalOpen(true);
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
      <h1 className="text-2xl mb-4">Codex Carousel V1.0</h1>
      {error && <div className="text-red-400 mb-4">{error}</div>}

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Backend Status</h2>
        <div className="text-sm grid grid-cols-2 gap-2">
          <div><strong>API Reachable:</strong> {health?.ok ? 'Verified' : 'Failed'}</div>
          <div><strong>Storage Status:</strong> {health?.storageStatus ?? 'Unknown'}</div>
          <div><strong>Ledger Writable:</strong> {health?.ledgerWritable ? 'Verified' : 'Failed'}</div>
          <div><strong>Demo Mode:</strong> {health?.demoMode ? 'Observed' : 'Off by default'}</div>
        </div>
      </section>

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Active Profile Card</h2>
        {active ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Alias:</strong> {active.alias}</div>
            <div><strong>Plan/Capacity Card:</strong> {active.plan}</div>
            <div><strong>5H Window Status:</strong> {active.fiveHourStatus}</div>
            <div><strong>Weekly/Plan Status:</strong> {active.weeklyStatus}</div>
            <div><strong>Credits Status:</strong> {active.creditsStatus}</div>
            <div><strong>Verification:</strong> {active.verificationStatus}</div>
            <div><strong>Recommendation:</strong> {active.recommendationReason ?? 'No recommendation because usage status is unknown'}</div>
            <div><strong>Last Activated:</strong> {active.lastActivatedAt ?? 'Unknown'}</div>
          </div>
        ) : <div className="text-sm">Unknown</div>}
      </section>

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">State Labels</h2>
        <div className="text-xs text-gray-300">{STATE_LABELS.join(' • ')}</div>
      </section>

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Profile Table</h2>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="border border-gray-800 p-2 flex items-center justify-between text-sm">
              <div>
                <div>{p.alias} ({p.plan})</div>
                <div className="text-xs text-gray-400">Verification {p.verificationStatus} • Snapshot {p.snapshotStatus ?? 'Unknown'}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-blue-600" onClick={() => runSwitchDryRun(p.id)}>Dry-run switch</button>
                <button className="px-3 py-1 border border-green-600" onClick={() => { setSwitchTarget(p); setSwitchDryRun(null); setSwitchConfirm(false); }}>Switch profile</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 border border-gray-700 p-4">
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
          <button className="px-3 py-1 border border-green-600 col-span-2" onClick={captureCurrent}>Capture current login</button>
        </div>
      </section>

      {switchTarget && (
        <section className="mb-4 border border-yellow-600 p-4">
          <h2 className="font-bold mb-2">Switch Profile</h2>
          <div className="text-sm">Switch requires confirmation. {settings?.localSwitchingEnabled ? 'Observed' : 'Local switching disabled'}</div>
          <button className="mt-2 px-3 py-1 border border-blue-500" onClick={() => runSwitchDryRun(switchTarget.id)} disabled={switchLoading}>{switchLoading ? 'Running dry-run...' : 'Dry-run switch'}</button>
          {switchDryRun && (
            <div className="mt-2 text-sm">
              <div><strong>Dry-run result:</strong> {switchDryRun.dryRun ? 'Dry-run only' : 'Failed'}</div>
              <div><strong>Verification status:</strong> {switchDryRun.verification?.targetProfile ?? 'Unknown'}</div>
              <div><strong>Warnings:</strong> {(switchDryRun.warnings ?? []).join(' | ') || 'Unknown'}</div>
            </div>
          )}
          <label className="block mt-3"><input type="checkbox" checked={switchConfirm} onChange={(e) => setSwitchConfirm(e.target.checked)} /> Confirm real switch</label>
          <button className="mt-2 px-3 py-1 border border-red-500" onClick={runRealSwitch} disabled={!switchConfirm}>Switch profile</button>
        </section>
      )}

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Usage Snapshot Modal</h2>
        <button className="px-3 py-1 border border-blue-500" onClick={openUsageModal} disabled={!activeProfileId}>Open usage snapshot modal</button>
      </section>

      {usageModalOpen && (
        <section className="mb-4 border border-blue-700 p-4 text-sm">
          <h3 className="font-bold">Usage Snapshot Modal</h3>
          <button className="mb-2 px-2 py-1 border border-gray-600" onClick={() => setUsageModalOpen(false)}>Close</button>
          <div className="max-h-40 overflow-auto">
            {usageModalData.map((s) => <div key={s.id} className="border-b border-gray-800 py-1">{s.createdAt} • {s.fiveHourStatus}/{s.weeklyStatus}/{s.creditsStatus} • {s.source}</div>)}
            {usageModalData.length === 0 && <div>Unknown</div>}
          </div>
        </section>
      )}

      <section className="mb-4 border border-gray-700 p-4">
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

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Settings Panel</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="col-span-2"><input type="checkbox" checked={settings?.localSwitchingEnabled ?? false} onChange={(e) => saveSettings({ localSwitchingEnabled: e.target.checked })} /> Local switching enabled</label>
          <label>Codex profile root path
            <input className="block bg-black border border-gray-600 w-full" value={settings?.codexProfileRootPath ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexProfileRootPath: e.target.value } : s)} />
          </label>
          <label>Codex launch command
            <input className="block bg-black border border-gray-600 w-full" value={settings?.codexLaunchCommand ?? ''} onChange={(e) => setSettings((s) => s ? { ...s, codexLaunchCommand: e.target.value } : s)} />
          </label>
          <button className="px-3 py-1 border border-blue-500 col-span-2" onClick={() => saveSettings({ codexProfileRootPath: settings?.codexProfileRootPath ?? null, codexLaunchCommand: settings?.codexLaunchCommand ?? null })}>Save settings</button>
        </div>
        <button className="mt-3 px-3 py-1 border border-green-500" onClick={launchCodex}>Launch Codex</button>
      </section>

      <section className="mb-4 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Doctor Panel</h2>
        <div className="text-sm">Status: {doctor?.status ?? 'Unknown'}</div>
        {doctor && doctor.issues.length > 0 && <ul className="list-disc list-inside text-yellow-300">{doctor.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      </section>

      <section className="border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Event Ledger</h2>
        <div className="max-h-64 overflow-auto text-xs space-y-1">
          {ledger.map((evt) => (
            <div key={evt.id} className="border-b border-gray-800 pb-1"><strong>{evt.eventType}</strong> [{evt.severity}] — {evt.message}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
