import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../services/superAdminApi';
import { supabase } from '../supabaseClient';
import PortalLayout from '../components/layout/PortalLayout';

const CLUSTERS = [
  { name: 'Core API Cluster', status: 'active', cpu: '42%', mem: '3.1GB', icon: 'dns' },
  { name: 'Redis Persistence', status: 'active', cpu: '12%', mem: '14GB', icon: 'memory' },
  { name: 'Worker Node Group B', status: 'warning', cpu: '98%', mem: 'RESTARTING', icon: 'settings_suggest' },
  { name: 'Media Transcoder', status: 'active', cpu: '5%', mem: 'IDLE', icon: 'videocam' },
];

const ACTION_COLORS = {
  tenant_created: 'text-secondary',
  tenant_updated: 'text-secondary',
  tenant_deleted: 'text-[#FF6F59]',
  tenant_onboarded: 'text-[#2FBE8F]',
  unauthorized_login: 'text-[#FF6F59]',
};

export default function SuperAdminMonitoring({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('all'); // 'all' | '24h'
  const [actionFilter, setActionFilter] = useState('all');
  const [pagination, setPagination] = useState({ total: 0 });

  const load = useCallback(async () => {
    try {
      const data = await superAdminApi.getAuditLogs({ page, limit: 50 });
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0 });
    } catch (e) { console.error(e); }
  }, [page]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate('/login');
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);
        if (prof?.role !== 'super_admin') return navigate('/admin/dashboard');
        await load();
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    init();
  }, [navigate]);

  useEffect(() => { if (profile) load(); }, [load, profile]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

  const visibleLogs = logs.filter((l) => {
    const inRange = range === '24h'
      ? new Date(l.created_at).getTime() >= Date.now() - 24 * 3600 * 1000
      : true;
    const inAction = actionFilter === 'all' || l.action === actionFilter;
    return inRange && inAction;
  });

  const exportCsv = () => {
    if (!visibleLogs.length) return;
    const rows = [
      ['Timestamp', 'User', 'Action', 'Target', 'Status'],
      ...visibleLogs.map((l) => [
        new Date(l.created_at).toLocaleString('fr-TN'),
        l.profiles ? `${l.profiles.prenom || ''} ${l.profiles.nom || ''}`.trim() : 'System',
        l.action,
        l.target_name || l.target_type || '',
        l.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !profile) {
    return <div className="flex h-screen items-center justify-center" style={{ background: '#f4f6f9' }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" /></div>;
  }

  const uptimeBars = [95, 88, 92, 85, 90, 97, 93, 99, 96, 100];

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">System Health & Monitoring</h1>
          <p className="text-on-surface-variant text-sm mt-1">Real-time infrastructure performance analytics and comprehensive audit tracking.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setRange((r) => (r === '24h' ? 'all' : '24h'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              range === '24h' ? 'bg-secondary text-white border-secondary' : 'border-outline-variant/30 hover:bg-surface-container-low'
            }`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
            {range === '24h' ? 'Toutes les dates' : 'Dernières 24h'}
          </button>
          <button onClick={exportCsv} disabled={visibleLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-outline-variant/30 hover:bg-surface-container-low disabled:opacity-40">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">System Uptime (Overall)</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-sora text-3xl font-bold text-primary">99.98%</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2fbe8f1a] text-[#2fbe8f] text-xs font-semibold">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_upward</span>
                  +0.02%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {uptimeBars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `rgba(0,84,203,${0.15 + (i / uptimeBars.length) * 0.85})` }} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined p-2 rounded-xl bg-secondary/10 text-secondary" style={{ fontSize: 18 }}>speed</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Avg Latency</span>
            </div>
            <p className="font-sora text-2xl font-bold text-primary">124ms</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#2FBE8F] animate-pulse" />
              <span className="text-xs text-on-surface-variant">Real-time monitoring</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined p-2 rounded-xl bg-[#FF6F59]/10 text-[#FF6F59]" style={{ fontSize: 18 }}>report_problem</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Critical Errors</span>
            </div>
            <p className="font-sora text-2xl font-bold text-primary">0.03%</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[#2FBE8F]" style={{ fontSize: 12 }}>arrow_downward</span>
              <span className="text-xs text-[#2FBE8F] font-semibold">12% improvement</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-primary-container rounded-3xl p-6 text-white min-h-[280px]">
          <h2 className="font-sora text-base font-semibold mb-1">Global Traffic Flow</h2>
          <p className="text-sm opacity-70 mb-4">Visualizing packets across primary CDN nodes</p>
          <div className="flex gap-6 mb-6">
            <div><span className="text-xs opacity-60 uppercase tracking-wider">Peak Load</span><p className="font-sora text-xl font-bold">8.4k rps</p></div>
            <div><span className="text-xs opacity-60 uppercase tracking-wider">Nodes Active</span><p className="font-sora text-xl font-bold">142/142</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['AWS-EAST-1: ACTIVE', 'GCP-EUROPE: ACTIVE', 'AZURE-ASIA: STABLE'].map((n) => (
              <span key={n} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/15">{n}</span>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
          <h2 className="font-sora text-base font-semibold text-primary mb-4">Server Clusters</h2>
          <div className="space-y-3">
            {CLUSTERS.map((c, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl bg-surface-container-low transition-colors hover:bg-surface-container cursor-pointer ${c.status === 'warning' ? 'border-l-4 border-[#FFB020]' : ''}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.status === 'active' ? '#2FBE8F' : '#FFB020' }}>{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{c.name}</p>
                  <p className="text-xs text-on-surface-variant">CPU: {c.cpu} | MEM: {c.mem}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>chevron_right</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl shadow-[0px_8px_16px_rgba(16,35,63,0.08)] overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/15 flex items-center justify-between">
          <div>
            <h2 className="font-sora text-base font-semibold text-primary">System Audit Log</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Immutable history of all administrative and tenant actions.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-on-surface-variant font-semibold">
              <option value="all">Toutes les actions</option>
              {Object.keys(ACTION_COLORS).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-container text-white">
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Timestamp</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">User</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Action</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Target</th>
                <th className="px-5 py-3.5 text-right font-semibold uppercase tracking-wider text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => {
                const userName = log.profiles ? `${log.profiles.prenom || ''} ${log.profiles.nom || ''}`.trim() : 'System';
                const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={log.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-5 py-3.5"><span className="text-xs font-mono text-on-surface-variant">{new Date(log.created_at).toLocaleString('fr-TN')}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-[10px] font-bold">{initials || 'SA'}</span>
                        <span className="text-xs font-semibold text-primary">{userName || 'System Auth'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className={`text-xs font-semibold ${ACTION_COLORS[log.action] || 'text-primary'}`}>{log.action}</span></td>
                    <td className="px-5 py-3.5"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary/10 text-secondary border border-secondary/20">{log.target_name || log.target_type || '—'}</span></td>
                    <td className="px-5 py-3.5 text-right"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${log.status === 'success' ? 'bg-[#2FBE8F]/10 text-[#2FBE8F]' : log.status === 'blocked' ? 'bg-[#FF6F59]/10 text-[#FF6F59]' : 'bg-surface-container text-on-surface-variant'}`}>{log.status === 'success' ? 'Success' : log.status === 'blocked' ? 'Blocked' : log.status}</span></td>
                  </tr>
                );
              })}
              {visibleLogs.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-on-surface-variant">Aucune action enregistrée sur cette période.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination.total > 50 && (
          <div className="px-5 py-3 border-t border-outline-variant/15 text-center">
            <button onClick={() => setPage((p) => p + 1)} className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1 mx-auto">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard_double_arrow_down</span>
              Charger l'historique plus ancien
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-full shadow-lg text-sm font-semibold animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2FBE8F] animate-pulse" />
          All systems operational
        </div>
      </div>
    </PortalLayout>
  );
}
