import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { kpiApi, formationApi, memberApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { getRoleLabel } from '../utils/roles';
import { exportDashboardToExcel } from '../utils/exportDashboardExcel';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';


// ─── Intervalles de rafraîchissement ────────────────────────────────────────
const REFRESH_KPI_MS     = 30_000;  // KPIs généraux  : 30s
const REFRESH_SESSIONS_MS = 10_000; // Sessions live  : 10s

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDT(val) {
  return typeof val === 'number'
    ? val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : '—';
}

function formatTime(minutes) {
  if (minutes == null) return '—';
  if (minutes <= 0) return 'Terminé';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m} min`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function formatTimeShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { timeStyle: 'short' });
}

// ─── Composant StatCard ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent = '#0054cb', to, badge, pulse }) {
  const bg = accent === '#2fbe8f' ? 'rgba(47,190,143,0.1)'
    : accent === '#ba1a1a'        ? 'rgba(186,26,26,0.09)'
    : accent === '#f59e0b'        ? 'rgba(245,158,11,0.1)'
    : accent === '#8b5cf6'        ? 'rgba(139,92,246,0.1)'
    : 'rgba(0,84,203,0.09)';

  const inner = (
    <div
      className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 h-full transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
      style={{ padding: '18px 20px', boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: accent }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: accent }} />
        </span>
      )}
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{ background: bg, color: accent }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{icon}</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant leading-tight">{label}</span>
      </div>
      <p className="font-sora font-bold text-primary" style={{ fontSize: 22 }}>{value}</p>
      {sub && <p className="text-[11px] text-on-surface-variant mt-1 font-medium">{sub}</p>}
      {badge != null && (
        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: bg, color: accent }}>
          {badge}
        </span>
      )}
    </div>
  );

  return to
    ? <Link to={to} className="block no-underline hover:no-underline h-full">{inner}</Link>
    : inner;
}

// ─── Tooltip personnalisé Recharts ───────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-outline-variant/20 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-primary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name} : <strong>{typeof p.value === 'number' ? p.value.toLocaleString('fr-FR') : p.value}</strong>
          {p.name === 'CA (DT)' ? ' DT' : p.name === 'Occupation (%)' ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminDashboard({ session }) {
  const navigate  = useNavigate();
  const [profile, setProfile]     = useState(null);
  const [kpis,    setKpis]        = useState(null);
  const [chart,   setChart]       = useState(null);
  const [formations, setFormations] = useState([]);
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error,   setError]       = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting,   setExporting]   = useState(false);

  // Refs pour les intervalles — évite les fuites mémoire
  const kpiTimerRef     = useRef(null);
  const sessionTimerRef = useRef(null);

  // ── Chargement initial du profil ─────────────────────────────────────────
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(async ({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setProfile(data);

        if (data?.role === 'admin' && data?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', data.tenant_id)
            .single();
          if (tenant?.settings?.onboarding_completed !== true) {
            navigate('/admin/onboarding', { replace: true });
          }
        }
      });
  }, [session, navigate]);

  // ── Fetch KPIs principal (silencieux après le 1er) ───────────────────────
  const fetchKpis = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [kpiData, chartData, formationsRes, pendingRes] = await Promise.all([
        kpiApi.getAll(),
        kpiApi.getRevenueChart(),
        formationApi.getAll({ statut: 'planifiee' }),
        memberApi.getPendingAccounts().catch(() => ({ pending: [] })),
      ]);
      setKpis(kpiData);
      setChart(chartData);
      setFormations(formationsRes.formations || []);
      setPendingAccounts(pendingRes.pending || []);
      setLastRefresh(new Date());
      setError('');
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── Fetch sessions seulement (très fréquent) ────────────────────────────
  const fetchSessionsOnly = useCallback(async () => {
    try {
      const kpiData = await kpiApi.getAll();
      setKpis((prev) => prev
        ? { ...prev, sessionsEnCours: kpiData.sessionsEnCours, reservationsDuJour: kpiData.reservationsDuJour }
        : kpiData
      );
      setLastRefresh(new Date());
    } catch (_) { /* silencieux */ }
  }, []);

  // ── Démarrage des intervalles ────────────────────────────────────────────
  useEffect(() => {
    fetchKpis(false); // Premier chargement complet

    // KPIs complets toutes les 30s
    kpiTimerRef.current = setInterval(() => fetchKpis(true), REFRESH_KPI_MS);
    // Sessions live toutes les 10s
    sessionTimerRef.current = setInterval(fetchSessionsOnly, REFRESH_SESSIONS_MS);

    return () => {
      clearInterval(kpiTimerRef.current);
      clearInterval(sessionTimerRef.current);
    };
  }, [fetchKpis, fetchSessionsOnly]);

  // ── Export Excel ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!kpis || !chart) return;
    setExporting(true);
    try {
      await exportDashboardToExcel(kpis, chart);
    } catch (e) {
      alert('Erreur export Excel : ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // ── Approuver / Rejeter un compte ───────────────────────────────────────
  const handleAccountAction = async (id, action) => {
    setApprovingId(id);
    try {
      await memberApi.approveAccount(id, action);
      setPendingAccounts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setApprovingId(null);
    }
  };

  // ── Écran de chargement initial ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#f4f6f9' }}>
        <div className="w-14 h-14 rounded-full border-4 animate-spin mb-4"
          style={{ borderColor: 'rgba(0,84,203,0.15)', borderTopColor: '#0054cb' }} />
        <p className="text-sm text-on-surface-variant font-medium">Chargement du tableau de bord…</p>
      </div>
    );
  }

  // ── Valeurs KPIs avec fallback ───────────────────────────────────────────
  const k = kpis || {};
  const ca = k.chiffreAffaires || { jour: 0, mois: 0, annee: 0 };
  const membres = k.nouveauxMembres || { moisActuel: 0, moisPrecedent: 0, evolution: 0 };
  const sessions = k.sessionsEnCours || [];
  const topMembres = k.topMembres || [];
  const tauxOccupation = k.tauxOccupation || [];
  const revenueChart = chart?.revenueChart || [];
  const occupationChart = chart?.occupationChart || [];

  const evolutionLabel = membres.evolution > 0
    ? `▲ +${membres.evolution}% vs mois préc.`
    : membres.evolution < 0
      ? `▼ ${membres.evolution}% vs mois préc.`
      : '→ Stable vs mois préc.';

  const evolutionColor = membres.evolution > 0 ? '#2fbe8f'
    : membres.evolution < 0 ? '#ba1a1a' : '#64748b';

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="mb-6 animate-fade-up">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-sora font-bold text-primary" style={{ fontSize: 26 }}>
              {greeting()}, {profile?.prenom || 'Admin'} 👋
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Tableau de bord — {getRoleLabel(profile?.role)}
              {lastRefresh && (
                <span className="ml-2 text-xs text-on-surface-variant/60">
                  · Mis à jour {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              disabled={exporting || !kpis}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-xl font-semibold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {exporting ? 'sync' : 'download'}
              </span>
              {exporting ? 'Export…' : 'Export Excel'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-error-container text-on-error-container text-sm rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {error}
        </div>
      )}

      {/* ── Grille KPIs — Ligne 1 (Membres + CA) ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4 animate-fade-up">
        <StatCard
          label="Membres actifs"
          value={k.membresActifs ?? '—'}
          sub={`${membres.moisActuel} nouveaux ce mois`}
          badge={evolutionLabel}
          icon="group"
          accent="#0054cb"
        />
        <StatCard
          label="CA du mois"
          value={`${formatDT(ca.mois)} DT`}
          sub={`Aujourd'hui : ${formatDT(ca.jour)} DT`}
          icon="payments"
          accent="#2fbe8f"
          to="/admin/payments"
        />
        <StatCard
          label="CA annuel"
          value={`${formatDT(ca.annee)} DT`}
          sub="Paiements encaissés cette année"
          icon="bar_chart"
          accent="#8b5cf6"
          to="/admin/payments"
        />
        <StatCard
          label="Paiements en attente"
          value={`${formatDT(k.paiementsEnAttente?.montantTotal ?? 0)} DT`}
          sub={`${k.paiementsEnAttente?.count ?? 0} paiement(s)`}
          icon="pending_actions"
          accent="#ba1a1a"
          to="/admin/payments"
        />
      </div>

      {/* ── Grille KPIs — Ligne 2 (Opérations) ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6 animate-fade-up">
        <StatCard
          label="Sessions en cours"
          value={sessions.length}
          sub="Sessions actives maintenant"
          icon="timer"
          accent="#f59e0b"
          pulse={sessions.length > 0}
        />
        <StatCard
          label="Réservations du jour"
          value={k.reservationsDuJour ?? '—'}
          sub="Confirmées + en attente"
          icon="event_available"
          accent="#2fbe8f"
          to="/admin/agenda"
        />
        <StatCard
          label="Abonnements expirant"
          value={k.abonnementsExpirant ?? '—'}
          sub="Dans les 7 prochains jours"
          icon="card_membership"
          accent={k.abonnementsExpirant > 0 ? '#ba1a1a' : '#0054cb'}
        />
        <StatCard
          label="Formations du jour"
          value={k.formationsDuJour ?? 0}
          sub="Sessions planifiées"
          icon="school"
          accent="#8b5cf6"
        />
      </div>

      {/* ── Graphiques ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-fade-up">

        {/* Graphique CA 6 mois */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-sora font-bold text-primary text-base">Évolution du CA</h2>
              <p className="text-xs text-on-surface-variant">6 derniers mois</p>
            </div>
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[rgba(47,190,143,0.1)]">
              <span className="material-symbols-outlined text-[#2fbe8f]" style={{ fontSize: 17 }}>trending_up</span>
            </span>
          </div>
          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v} DT`} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="ca" name="CA (DT)"
                  stroke="#2fbe8f" strokeWidth={2.5} dot={{ r: 4, fill: '#2fbe8f' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-on-surface-variant">
              Aucune donnée disponible
            </div>
          )}
        </div>

        {/* Graphique Taux Occupation */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-sora font-bold text-primary text-base">Taux d'occupation</h2>
              <p className="text-xs text-on-surface-variant">Par espace — mois en cours</p>
            </div>
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[rgba(0,84,203,0.09)]">
              <span className="material-symbols-outlined text-[#0054cb]" style={{ fontSize: 17 }}>domain</span>
            </span>
          </div>
          {tauxOccupation.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tauxOccupation} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="nom" tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="taux" name="Occupation (%)" fill="#0054cb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-on-surface-variant">
              Aucune donnée disponible
            </div>
          )}
        </div>
      </div>

      {/* ── Ligne 3 : Sessions live + Top membres ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 animate-fade-up">

        {/* Sessions en cours */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-sora font-bold text-primary text-base">Sessions en cours</h2>
              {sessions.length > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-[#f59e0b] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]" />
                </span>
              )}
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              Rafraîchi toutes les 10s
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-2">timer_off</span>
              <p className="text-sm text-on-surface-variant">Aucune session active en ce moment</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {sessions.map((s) => {
                const restant = s.tempsRestant ?? 0;
                const urgence = restant <= 15 && restant > 0;
                const depasse = restant <= 0;
                return (
                  <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${
                        depasse  ? 'bg-[rgba(186,26,26,0.1)] text-[#ba1a1a]'
                        : urgence ? 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]'
                        : 'bg-[rgba(47,190,143,0.1)] text-[#2fbe8f]'
                      }`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-primary text-sm truncate">{s.membre}</p>
                        <p className="text-xs text-on-surface-variant truncate">{s.espace}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${depasse ? 'text-[#ba1a1a]' : urgence ? 'text-[#f59e0b]' : 'text-[#2fbe8f]'}`}>
                        {depasse ? '⚠ Dépassé' : formatTime(restant)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {s.check_in ? new Date(s.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 5 membres */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sora font-bold text-primary text-base">Top membres</h2>
            <span className="text-xs text-on-surface-variant font-medium">Par CA annuel</span>
          </div>
          {topMembres.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-2">leaderboard</span>
              <p className="text-sm text-on-surface-variant">Aucun paiement enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topMembres.map((m, i) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low/50 transition-colors">
                    <span className="text-lg w-6 text-center shrink-0">{medals[i] || `#${i + 1}`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary text-sm truncate">{m.nom}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{m.email}</p>
                    </div>
                    <span className="font-bold text-[#2fbe8f] text-sm shrink-0">
                      {formatDT(m.ca)} DT
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Section Demandes en attente ───────────────────────────────── */}
      {pendingAccounts.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-amber-200/60 mb-6 animate-fade-up"
          style={{ boxShadow: '0 4px 16px rgba(245,158,11,0.08)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#d97706' }}>pending_actions</span>
              <h2 className="font-sora font-bold text-primary text-base">Demandes de compte en attente</h2>
            </div>
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white animate-pulse"
              style={{ background: '#d97706' }}>{pendingAccounts.length}</span>
          </div>

          <div className="divide-y divide-outline-variant/10">
            {pendingAccounts.map((p) => {
              const roleColors = { formateur: { bg: '#f5f3ff', text: '#6d28d9' }, member: { bg: '#eff6ff', text: '#1d4ed8' }, default: { bg: '#f1f5f9', text: '#475569' } };
              const rc = roleColors[p.role] || roleColors.default;
              const isActing = approvingId === p.id;
              const dateInscrit = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={p.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm text-white"
                      style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
                      {(p.prenom?.[0] || '').toUpperCase()}{(p.nom?.[0] || '').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-primary text-sm">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-on-surface-variant truncate">{p.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.text }}>
                          {p.role === 'formateur' ? 'Formateur' : 'Membre'}
                          {p.specialite ? ` · ${p.specialite}` : ''}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">Inscrit le {dateInscrit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAccountAction(p.id, 'reject')}
                      disabled={isActing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ borderColor: 'rgba(186,26,26,0.25)', color: '#ba1a1a', background: 'rgba(186,26,26,0.05)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      Rejeter
                    </button>
                    <button
                      onClick={() => handleAccountAction(p.id, 'approve')}
                      disabled={isActing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 text-white"
                      style={{ background: isActing ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)' }}
                    >
                      {isActing
                        ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                        : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                      }
                      {isActing ? 'En cours…' : 'Approuver'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ligne Formations de la semaine ──────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10 mb-6 animate-fade-up"
        style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8b5cf6]" style={{ fontSize: 20 }}>school</span>
            <h2 className="font-sora font-bold text-primary text-base">Suivi des formations programmées</h2>
          </div>
          <Link to="/admin/formations" className="text-xs font-semibold text-secondary hover:underline">
            Gérer les formations
          </Link>
        </div>

        {formations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-2">school</span>
            <p className="text-sm text-on-surface-variant">Aucune formation programmée à venir</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10 pb-2">
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Formation</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Formateur</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Date de début</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Espace</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant text-center">Inscriptions</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Prix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {formations.slice(0, 5).map((f) => {
                  const formateurName = f.profiles ? `${f.profiles.prenom} ${f.profiles.nom}` : '—';
                  const fillPct = f.capacite_max > 0 ? Math.min(100, Math.round((f.nb_inscrits / f.capacite_max) * 100)) : 0;
                  const barColor = fillPct >= 90 ? 'bg-red-500' : fillPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';

                  return (
                    <tr key={f.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-3 font-semibold text-primary">{f.titre}</td>
                      <td className="py-3 text-on-surface-variant">
                        <div>{formateurName}</div>
                        {f.profiles?.specialite && <div className="text-[10px] text-on-surface-variant/70">{f.profiles.specialite}</div>}
                      </td>
                      <td className="py-3 text-on-surface-variant">
                        <div>{new Date(f.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                        <div className="text-[10px] text-on-surface-variant/70">{formatTimeShort(f.date_debut)}</div>
                      </td>
                      <td className="py-3 text-on-surface-variant">{f.espaces?.nom || '—'}</td>
                      <td className="py-3">
                        <div className="flex flex-col items-center justify-center min-w-[100px]">
                          <div className="flex items-center justify-between w-full text-[10px] mb-1">
                            <span className="font-semibold text-on-surface-variant">{f.nb_inscrits} / {f.capacite_max}</span>
                            <span className="font-bold text-on-surface-variant">{fillPct}%</span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-outline-variant/10 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${fillPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-bold text-secondary">
                        {f.prix_inscription > 0 ? `${f.prix_inscription} DT` : 'Gratuit'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Graphique occupation 6 mois + Actions rapides ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-up">

        {/* Évolution occupation 6 mois */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/10"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-sora font-bold text-primary text-base">Taux d'occupation moyen</h2>
              <p className="text-xs text-on-surface-variant">Évolution sur 6 mois</p>
            </div>
          </div>
          {occupationChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={occupationChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="taux" name="Occupation (%)"
                  stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-on-surface-variant">
              Aucune donnée disponible
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div className="lg:col-span-5 bg-primary text-white rounded-3xl p-5 relative overflow-hidden"
          style={{ boxShadow: '0 4px 16px rgba(16,35,63,0.12)' }}>
          <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h2 className="font-sora font-bold text-base mb-4">Actions rapides</h2>
            <div className="flex flex-col gap-2">
              {[
                { to: '/admin/agenda',   icon: 'calendar_month',         label: 'Agenda & réservations' },
                { to: '/admin/payments', icon: 'account_balance_wallet',  label: 'Gestion paiements' },
                { to: '/admin/pricing',  icon: 'sell',                    label: 'Tarifs & codes promo' },
                { to: '/admin/cancellation-policy', icon: 'policy',      label: 'Politique d\'annulation' },
              ].map(({ to, icon, label }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2.5 transition-colors no-underline text-white">
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  <span className="font-semibold text-sm">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

    </PortalLayout>
  );
}
