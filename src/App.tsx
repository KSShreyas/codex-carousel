/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RotateCcw, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Terminal, 
  Shield, 
  Clock, 
  Database,
  RefreshCw,
  Power,
  ChevronRight,
  User,
  Zap,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from './lib/utils';
import { 
  AccountId, 
  AccountRegistryRecord, 
  AccountHealthRecord, 
  RuntimeState, 
  LedgerCheckpoint,
  AccountState,
  AppConfig
} from './carousel/types';

const StatusBadge = ({ state }: { state: AccountState }) => {
  const styles = {
    [AccountState.Available]: 'text-[#888] border-[#333]',
    [AccountState.Active]: 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/5',
    [AccountState.Draining]: 'text-[#FF9900] border-[#FF9900]/30 bg-[#FF9900]/5',
    [AccountState.CoolingDown]: 'text-[#FF9900] border-[#FF9900]/30',
    [AccountState.Recovering]: 'text-purple-400 border-purple-900/30',
    [AccountState.Suspended]: 'text-[#FF4444] border-[#FF4444]/30',
    [AccountState.Disabled]: 'text-[#666] border-[#222]',
  };

  return (
    <span className={cn('px-1.5 py-0.5 rounded-none text-[9px] font-mono uppercase tracking-[0.1em] border', styles[state])}>
      {state}
    </span>
  );
};

export default function App() {
  const [data, setData] = useState<{
    runtime: RuntimeState;
    accounts: (AccountRegistryRecord & { health: AccountHealthRecord })[];
    ledger: LedgerCheckpoint | null;
    config: AppConfig | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ timestamp: string; event: string; [key: string]: any }[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=50');
      const logData = await res.json();
      setLogs(logData);
    } catch (err) {
      // Silently fail - logs are secondary
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      setData(json);
      setLoading(false);
      // Also fetch real backend logs
      await fetchLogs();
    } catch (err) {
      setError('Failed to connect to supervisor');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSwitch = async () => {
    const res = await fetch('/api/rotate', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      console.log('Rotation successful:', data.selectedId);
    } else {
      const err = await res.json();
      console.error('Rotation failed:', err.error);
    }
    // Refresh data to show updated state
    setTimeout(fetchData, 500);
  };

  const handleImport = async () => {
    const alias = prompt('Enter Account Alias:');
    if (!alias) return;
    const priorityStr = prompt('Enter Priority (default: 1):') || '1';
    const sourcePath = prompt('Enter Source Path (optional):') || undefined;
    
    const res = await fetch('/api/accounts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        alias, 
        priority: parseInt(priorityStr),
        sourcePath 
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Imported:', data.id);
      fetchData();
    } else {
      const err = await res.json();
      console.error('Import failed:', err.error);
    }
  };

  const activeAccount = data?.accounts.find(a => a.id === data.runtime.activeAccountId);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans selection:bg-[#00FF41]/30 p-6 flex flex-col border-[8px] border-[#1A1A1A]">
      {/* Header */}
      <header className="flex justify-between items-end border-b border-[#333] pb-4 mb-6">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-[#666] font-mono">System Supervisor // Windows-x64</span>
          <h1 className="text-3xl font-bold tracking-tighter text-white uppercase">CODEX CAROUSEL <span className="text-[#00FF41] opacity-80 text-xl font-mono">V1.0.4</span></h1>
        </div>
        <div className="flex gap-8 text-right font-mono">
          <div>
            <div className="text-[10px] uppercase text-[#666]">Uptime</div>
            <div className="text-sm">{data ? formatDistanceToNow(new Date(data.runtime.uptimeStart)) : '...'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#666]">Bridge Status</div>
            <div className={cn("text-sm uppercase", data?.runtime.sessionStatus === 'switching' ? 'text-[#FF9900]' : 'text-[#00FF41]')}>
              {data?.runtime.sessionStatus === 'switching' ? 'ROTATING' : 'CONNECTED'}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] uppercase text-[#666]">Active PID</div>
            <div className="text-sm">88412</div>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6 flex-grow">
        {/* Left Column */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#141414] border border-[#333] p-5 rounded-sm relative overflow-hidden">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#888] mb-4 font-bold">Active Account</h2>
            {activeAccount ? (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#00FF41] flex items-center justify-center rounded-full text-black font-bold text-xl uppercase">
                    {activeAccount.alias[0]}
                  </div>
                  <div>
                    <div className="text-xl font-mono text-white leading-tight">{activeAccount.alias}</div>
                    <div className="text-[10px] text-[#666] uppercase font-mono tracking-tighter">ID: {activeAccount.id}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div className="bg-[#0F0F0F] p-3 border border-[#222]">
                    <div className="text-[9px] text-[#666] uppercase mb-1">5H Remaining</div>
                    <div className="text-lg text-[#00FF41]">
                      {activeAccount.health.usage ? `${Math.round((activeAccount.health.usage.five_hour_remaining / activeAccount.health.usage.five_hour_total) * 100)}%` : '--'}
                    </div>
                  </div>
                  <div className="bg-[#0F0F0F] p-3 border border-[#222]">
                    <div className="text-[9px] text-[#666] uppercase mb-1">Weekly Limit</div>
                    <div className="text-lg text-[#00FF41]">
                      {activeAccount.health.usage ? `${activeAccount.health.usage.weekly_remaining}/${activeAccount.health.usage.weekly_total}` : '--'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-sm text-[#444] font-mono">SESSION_IDLE</div>
            )}
          </div>

          <div className="bg-[#141414] border border-[#333] p-5 rounded-sm flex-grow">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#888] mb-4 font-bold">Session Ledger</h2>
            {data?.ledger ? (
              <div className="space-y-4 font-mono">
                <div className="border-l-2 border-[#00FF41] pl-3 py-1">
                  <div className="text-[10px] text-[#666] uppercase pb-0.5">Objective</div>
                  <div className="text-sm text-white truncate">{data.ledger.objective}</div>
                </div>
                <div className="border-l-2 border-[#333] pl-3 py-1">
                  <div className="text-[10px] text-[#666] uppercase pb-0.5">Project</div>
                  <div className="text-sm text-white truncate">{data.ledger.repoPath.split('/').pop() || 'codex-carousel/core'}</div>
                </div>
                <div className="border-l-2 border-[#333] pl-3 py-1">
                  <div className="text-[10px] text-[#666] uppercase pb-0.5">Last Checkpoint</div>
                  <div className="text-sm text-white">{formatDistanceToNow(new Date(data.ledger.timestamp))} ago</div>
                </div>
                <div className="mt-6 pt-4 border-t border-[#222] flex justify-between items-center">
                  <span className="text-[10px] font-mono text-[#444]">RESUME PAYLOAD: READY</span>
                  <div className="w-2 h-2 bg-[#00FF41] rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#333] font-mono uppercase text-[10px]">No active ledger recorded</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-auto">
             <button 
                onClick={handleManualSwitch}
                disabled={data?.runtime.sessionStatus === 'switching'}
                className="flex flex-col items-center justify-center p-4 bg-[#0F0F0F] border border-[#333] hover:border-[#00FF41]/50 transition-colors group disabled:opacity-30"
             >
                <RotateCcw className={cn("w-5 h-5 mb-2 text-[#666] group-hover:text-[#00FF41]", data?.runtime.sessionStatus === 'switching' && "animate-spin")} />
                <span className="text-[10px] font-mono text-[#888] uppercase tracking-[0.1em]">Force Rotate</span>
             </button>
             <button 
                onClick={handleImport}
                className="flex flex-col items-center justify-center p-4 bg-[#0F0F0F] border border-[#333] hover:border-white/50 transition-colors group"
             >
                <Plus className="w-5 h-5 mb-2 text-[#666] group-hover:text-white" />
                <span className="text-[10px] font-mono text-[#888] uppercase tracking-[0.1em]">Import Acc</span>
             </button>
          </div>
        </section>

        {/* Right Column */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="bg-[#141414] border border-[#333] flex-grow flex flex-col overflow-hidden">
            <div className="grid grid-cols-6 text-[10px] uppercase font-bold text-[#666] tracking-wider border-b border-[#333] p-3 bg-[#0F0F0F]">
              <span>Alias</span>
              <span>State</span>
              <span className="hidden md:block">Priority</span>
              <span>Usage</span>
              <span className="hidden md:block">Last Refresh</span>
              <span>Cooldown</span>
            </div>
            <div className="overflow-y-auto flex-grow font-mono text-[11px] custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {data?.accounts.sort((a,b) => (a.health.state === AccountState.Active ? -1 : 1)).map(acc => (
                  <motion.div 
                    layout
                    key={acc.id}
                    className={cn(
                      "grid grid-cols-6 p-3 border-b border-border-subtle items-center hover:bg-[#1A1A1A] transition-colors",
                      acc.health.state === AccountState.Active && "bg-[#00FF41]/5 shadow-[inset_2px_0_0_#00FF41]"
                    )}
                  >
                    <span className="text-white truncate pr-2">{acc.alias}</span>
                    <div className="flex">
                      <StatusBadge state={acc.health.state} />
                    </div>
                    <span className="text-[#666] hidden md:block">{acc.priority}</span>
                    <span className={cn(
                      acc.health.usage?.five_hour_remaining! < 5 ? 'text-[#FF4444]' : 'text-[#888]'
                    )}>
                      {acc.health.usage ? `${acc.health.usage.five_hour_remaining}u` : '--'}
                    </span>
                    <span className="text-[#444] hidden md:block truncate">
                      {acc.health.lastRefreshAt ? new Date(acc.health.lastRefreshAt).toLocaleTimeString() : '--'}
                    </span>
                    <span className={cn(
                      acc.health.cooldownUntil ? 'text-[#FF9900]' : 'text-[#444]'
                    )}>
                      {acc.health.cooldownUntil ? formatDistanceToNow(new Date(acc.health.cooldownUntil)) : '--'}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="h-48 bg-[#141414] border border-[#333] p-4 flex flex-col">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#888] mb-3 font-bold">System Events Log</h2>
            <div className="overflow-y-auto flex-grow font-mono text-[11px] space-y-1 custom-scrollbar">
              {logs.map((log, idx) => (
                <div key={`${log.timestamp}-${idx}`} className="flex gap-4 opacity-70">
                  <span className="text-[#666] shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={cn(
                    "uppercase",
                    log.event?.includes('ERROR') ? 'text-[#FF4444]' : 
                    log.event?.includes('failed') || log.event?.includes('warning') ? 'text-[#FF9900]' : 
                    'text-[#888]'
                  )}>{log.event}:</span>
                  <span className="text-[#999] truncate">{JSON.stringify(log).slice(50, 150)}...</span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-[#333] italic lowercase">Waiting for backend events...</div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-6 flex justify-between items-center text-[10px] text-[#444] font-mono border-t border-[#222] pt-4">
        <div>CONFIG: /src/carousel/config.ts</div>
        <div className="hidden md:block uppercase tracking-widest">V1.0.4-STABLE (BUILD 260423)</div>
        <div className="flex gap-4 text-[#666]">
          <span className="hover:text-[#00FF41] cursor-pointer">[F1] DOCTOR</span>
          <span className="hover:text-[#00FF41] cursor-pointer">[F5] ROTATE</span>
          <span className="hover:text-[#00FF41] cursor-pointer">[F12] RESET</span>
        </div>
      </footer>
    </div>
  );
}
