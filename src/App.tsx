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

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEvent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [doctor, setDoctor] = useState<{ status: string; issues: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch('/api/status');
      const data = await res.json();
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();
      const doctorRes = await fetch('/api/doctor');
      const doctorData = await doctorRes.json();
      setProfiles(data.profiles ?? []);
      setActiveProfileId(data.runtime?.activeProfileId ?? null);
      setLedger(data.ledger ?? []);
      setHealth(healthData);
      setDoctor(doctorData);
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

  const switchProfile = async (targetProfileId: string) => {
    await fetch('/api/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetProfileId }),
    });
    await load();
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl mb-4">Codex Carousel</h1>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Backend Connection Status</h2>
        <div className="text-sm">
          <div><strong>API Reachable:</strong> {health?.ok ? 'Yes' : 'No'}</div>
          <div><strong>Version:</strong> {health?.version ?? 'Unknown'}</div>
          <div><strong>Storage Status:</strong> {health?.storageStatus ?? 'Unknown'}</div>
          <div><strong>Ledger Writable:</strong> {health?.ledgerWritable ? 'Yes' : 'No'}</div>
          <div><strong>Last Event:</strong> {health?.lastEventTimestamp ?? 'Unknown'}</div>
        </div>
        {doctor && doctor.status !== 'healthy' && (
          <div className="mt-3 text-yellow-300">
            <strong>Doctor Warnings:</strong>
            <ul className="list-disc list-inside">
              {doctor.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
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
        ) : (
          <div>Unknown</div>
        )}
      </section>

      <section className="mb-6 border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Profiles</h2>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="border border-gray-800 p-2 flex items-center justify-between">
              <div>
                <div>{p.alias} ({p.plan})</div>
                <div className="text-xs text-gray-400">Recommendation: {p.recommendation}</div>
              </div>
              <button className="px-3 py-1 border border-green-600" onClick={() => switchProfile(p.id)}>
                Switch Profile
              </button>
            </div>
          ))}
          {profiles.length === 0 && <div>Unknown</div>}
        </div>
      </section>

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
          <label>5H Window Status
            <select className="block bg-black border border-gray-600 w-full" value={usageForm.fiveHourStatus} onChange={(e) => setUsageForm((s) => ({ ...s, fiveHourStatus: e.target.value as LimitStatus }))}>
              <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
            </select>
          </label>
          <label>Weekly/Plan Status
            <select className="block bg-black border border-gray-600 w-full" value={usageForm.weeklyStatus} onChange={(e) => setUsageForm((s) => ({ ...s, weeklyStatus: e.target.value as LimitStatus }))}>
              <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
            </select>
          </label>
          <label>Credits Status
            <select className="block bg-black border border-gray-600 w-full" value={usageForm.creditsStatus} onChange={(e) => setUsageForm((s) => ({ ...s, creditsStatus: e.target.value as LimitStatus }))}>
              <option>Available</option><option>Low</option><option>Exhausted</option><option>Unknown</option>
            </select>
          </label>
          <label>Observed Reset At
            <input className="block bg-black border border-gray-600 w-full" value={usageForm.observedResetAt} onChange={(e) => setUsageForm((s) => ({ ...s, observedResetAt: e.target.value }))} />
          </label>
          <label>Last Limit Banner
            <input className="block bg-black border border-gray-600 w-full" value={usageForm.lastLimitBanner} onChange={(e) => setUsageForm((s) => ({ ...s, lastLimitBanner: e.target.value }))} />
          </label>
          <label>Notes
            <input className="block bg-black border border-gray-600 w-full" value={usageForm.notes} onChange={(e) => setUsageForm((s) => ({ ...s, notes: e.target.value }))} />
          </label>
          <button className="px-3 py-1 border border-blue-500 col-span-2">Save Usage Snapshot</button>
        </form>
      </section>

      <section className="border border-gray-700 p-4">
        <h2 className="font-bold mb-2">Event Ledger</h2>
        <div className="max-h-64 overflow-auto text-xs space-y-1">
          {ledger.map((evt) => (
            <div key={evt.id} className="border-b border-gray-800 pb-1">
              <strong>{evt.eventType}</strong> [{evt.severity}] — {evt.message} ({new Date(evt.timestamp).toLocaleString()})
            </div>
          ))}
          {ledger.length === 0 && <div>Unknown</div>}
        </div>
      </section>
    </div>
  );
}
