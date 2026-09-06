import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../services/superAdminApi';
import { formationApi } from '../services/api';
import { exportFormationsToExcel } from '../utils/exportFormationsExcel';
import { supabase } from '../supabaseClient';
import PortalLayout from '../components/layout/PortalLayout';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const styles = `
@keyframes bento-fade-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
.bento-card { animation: bento-fade-in .45s ease-out both; }
.bento-card:nth-child(2) { animation-delay:.07s; }
.bento-card:nth-child(3) { animation-delay:.14s; }
.bento-card:nth-child(4) { animation-delay:.21s; }
`;

export default function SuperAdminDashboard({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [allFormations, setAllFormations] = useState([]);
  const [pendingTenants, setPendingTenants] = useState([]);
  const [coworkings, setCoworkings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate('/login');
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);
        if (prof?.role !== 'super_admin') return navigate('/admin/dashboard');
        const s = await superAdminApi.getStats();
        setStats(s);
        const fRes = await formationApi.getAll();
        setAllFormations(fRes.formations || []);
        const ptRes = await superAdminApi.getTenants({ statut: 'suspendu' });
        setPendingTenants(ptRes.tenants || []);
        const cwRes = await superAdminApi.getTenants({ statut: 'actif', limit: 50 });
        setCoworkings(cwRes.tenants || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [navigate]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

  const handleApproveTenant = async (id) => {
    try {
      await superAdminApi.updateTenant(id, { statut: 'actif' });
      setPendingTenants(prev => prev.filter(t => t.id !== id));
      const s = await superAdminApi.getStats();
      setStats(s);
    } catch (e) {
      alert('Erreur approbation : ' + e.message);
    }
  };

  const handleRejectTenant = async (id) => {
    if (!confirm('Rejeter cette demande ? Cela supprimera définitivement le coworking.')) return;
    try {
      await superAdminApi.deleteTenant(id);
      setPendingTenants(prev => prev.filter(t => t.id !== id));
      const s = await superAdminApi.getStats();
      setStats(s);
    } catch (e) {
      alert('Erreur rejet : ' + e.message);
    }
  };


  const handleDownloadCSV = () => {
    exportFormationsToExcel(allFormations);
  };

  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#f4f6f9' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  const safeStats = stats || {
    totalTenants: 0,
    mrr: 0,
    totalMembers: 0,
    activeTenants: 0,
    monthlyGrowth: [],
  };

  const cards = [
    { label: 'Total Coworkings', value: safeStats.totalTenants ?? 0, icon: 'domain', color: '#f95d00', bg: 'rgba(249,93,0,0.08)' },
    { label: 'MRR Total', value: `${(safeStats.mrr || 0).toLocaleString('fr-TN')} DT`, icon: 'payments', color: '#f95d00', bg: 'rgba(249,93,0,0.08)' },
    { label: 'Total Membres', value: safeStats.totalMembers ?? 0, icon: 'groups', color: '#100f0d', bg: 'rgba(16,15,13,0.06)' },
    { label: 'Coworkings Actifs', value: safeStats.activeTenants ?? 0, icon: 'check_circle', color: '#f95d00', bg: 'rgba(249,93,0,0.08)' },
  ];

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <style>{styles}</style>
      <div className="mb-8">
        <h1 className="font-sora text-2xl font-bold text-primary">Tableau de bord Super Admin</h1>
        <p className="text-on-surface-variant text-sm mt-1">Vue globale de la plateforme VCLOW</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="bento-card bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)] hover:shadow-[0px_8px_16px_rgba(16,35,63,0.08)] transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{c.label}</span>
              <span className="material-symbols-outlined p-2 rounded-xl" style={{ fontSize: 20, color: c.color, background: c.bg }}>{c.icon}</span>
            </div>
            <p className="font-sora text-3xl font-bold text-primary">{c.value}</p>
          </div>
        ))}
      </div>

      {/* ─── SECTION: Coworkings actifs (galerie avec images) ─── */}
      {coworkings.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/10 mb-8 shadow-[0px_4px_12px_rgba(16,35,63,0.05)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 22 }}>domain</span>
              <h2 className="font-sora text-lg font-semibold text-primary">Coworkings actifs</h2>
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: '#f95d00' }}>{coworkings.length}</span>
            </div>
            <button onClick={() => navigate('/super-admin/tenants')}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>domain</span>
              Gérer les Tenants
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coworkings.slice(0, 8).map((t) => (
              <div key={t.id} className="rounded-2xl overflow-hidden border border-outline-variant/10 bg-surface-container-lowest hover:shadow-[0px_8px_20px_rgba(16,35,63,0.1)] transition-shadow">
                <div className="h-28 overflow-hidden">
                  <img
                    src={t.cover_url || t.logo_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop'}
                    alt={t.nom}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sora font-bold text-primary text-sm truncate">{t.nom}</p>
                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title="Actif" />
                  </div>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1 mb-2">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                    {[t.adresse, t.ville, t.pays].filter(Boolean).join(', ') || 'Tunisie'}
                  </p>
                  {(t.latitude && t.longitude) && (
                    <p className="text-[10px] text-on-surface-variant/80 mb-2">
                      📍 {t.latitude}, {t.longitude}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>meeting_room</span>
                      {t.space_count ?? 0} espaces
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>groups</span>
                      {t.member_count ?? 0} membres
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {coworkings.length > 8 && (
            <p className="text-center text-xs text-on-surface-variant mt-4">
              + {coworkings.length - 8} autre(s) coworking(s) — consultez la <button
                className="text-secondary font-semibold hover:underline"
                onClick={() => navigate('/super-admin/tenants')}>gestion des tenants</button>
            </p>
          )}
        </div>
      )}

      {/* ─── SECTION: Demandes d'inscription de Coworkings ─── */}
      {pendingTenants.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-amber-200/60 mb-8 shadow-[0px_4px_12px_rgba(245,158,11,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#d97706]" style={{ fontSize: 22 }}>domain_disabled</span>
            <h2 className="font-sora text-lg font-semibold text-primary">Demandes d’inscription de Coworkings</h2>
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white animate-pulse" style={{ background: '#d97706' }}>
              {pendingTenants.length}
            </span>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {pendingTenants.map((t) => {
              const dateInscrit = new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={t.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center font-sora font-bold text-[#d97706] text-sm">
                      {(t.nom || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-primary">{t.nom}</p>
                      <p className="text-xs text-on-surface-variant">
                        {t.email} {t.telephone ? `· ${t.telephone}` : ''} {t.ville ? `· ${t.ville}` : ''}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/80 mt-0.5">Demande reçue le {dateInscrit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectTenant(t.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold hover:bg-red-50 transition-colors"
                      style={{ borderColor: 'rgba(186,26,26,0.25)', color: '#ba1a1a' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                      Rejeter
                    </button>
                    <button
                      onClick={() => handleApproveTenant(t.id)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
                      Activer le Coworking
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-sora text-lg font-semibold text-primary">Aperçu rapide</h2>
              <p className="text-xs text-on-surface-variant mt-1">Gérez vos coworkings clients</p>
            </div>
            <button onClick={() => navigate('/super-admin/tenants')} className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-sm font-semibold hover:bg-secondary/90 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>domain</span>
              Voir les Tenants
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 24 }}>payments</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">Revenus récurrents mensuels (MRR)</p>
                <p className="text-xs text-on-surface-variant">Croissance sur les 6 derniers mois</p>
              </div>
              <span className="font-sora font-bold text-secondary font-lg">{(stats?.mrr || 0).toLocaleString('fr-TN')} DT</span>
            </div>

            {/* Graphique MRR & Croissance */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Évolution du MRR (DT)</span>
                <span className="text-xs text-secondary font-bold">Actifs : {stats?.activeTenants || 0} coworkings</span>
              </div>
              {Array.isArray(safeStats.monthlyGrowth) && safeStats.monthlyGrowth.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={safeStats.monthlyGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f95d00" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f95d00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}`} width={45} />
                    <Tooltip formatter={(value) => [`${value} DT`, 'MRR']} />
                    <Area type="monotone" dataKey="mrr" stroke="#f95d00" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMrr)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-on-surface-variant">
                  Aucune donnée d'évolution disponible
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-primary-container rounded-3xl p-6 text-white">
          <h2 className="font-sora text-lg font-semibold mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <button onClick={() => navigate('/super-admin/tenants')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>domain</span>
              Gérer les Coworkings
            </button>
            <button onClick={() => navigate('/super-admin/users')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>groups</span>
              Gérer les Utilisateurs
            </button>
            <button onClick={() => navigate('/super-admin/billing')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>receipt_long</span>
              Facturation B2B
            </button>
            <button onClick={() => navigate('/super-admin/monitoring')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>monitor</span>
              Monitoring & Audit
            </button>
          </div>
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#2FBE8F] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Système</span>
            </div>
            <p className="text-sm opacity-90">Tous les systèmes opérationnels</p>
          </div>
        </div>
      </div>

      {/* ─── ROW 3: Catalogue Global des Formations (Lecture seule) ─── */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/10 shadow-[0px_2px_4px_rgba(16,35,63,0.04)] mt-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8b5cf6]" style={{ fontSize: 22 }}>school</span>
            <h2 className="font-sora text-lg font-semibold text-primary">Catalogue global des formations</h2>
          </div>
          {allFormations.length > 0 && (
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Télécharger la liste
            </button>
          )}
        </div>

        {allFormations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-2">school</span>
            <p className="text-sm text-on-surface-variant">Aucune formation créée sur la plateforme.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/10 pb-2">
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Formation</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Formateur</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Espace / Coworking</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Date début</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant text-center">Inscrits</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Tarif</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {allFormations.map((f) => {
                  const formateurName = f.profiles ? `${f.profiles.prenom} ${f.profiles.nom}` : '—';
                  const dateDebut = new Date(f.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                  const heureDebut = new Date(f.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={f.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-3 font-semibold text-primary">{f.titre}</td>
                      <td className="py-3 text-on-surface-variant">
                        <div>{formateurName}</div>
                        {f.profiles?.specialite && <div className="text-[10px] text-on-surface-variant/70">{f.profiles.specialite}</div>}
                      </td>
                      <td className="py-3 text-on-surface-variant">{f.espaces?.nom || '—'}</td>
                      <td className="py-3 text-on-surface-variant">
                        <div>{dateDebut}</div>
                        <div className="text-[10px] text-on-surface-variant/70">{heureDebut}</div>
                      </td>
                      <td className="py-3 text-center font-semibold text-on-surface-variant">
                        {f.nb_inscrits ?? 0} / {f.capacite_max}
                      </td>
                      <td className="py-3 text-right font-bold text-secondary">
                        {f.prix_inscription > 0 ? `${f.prix_inscription} DT` : 'Gratuit'}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                          f.statut === 'planifiee' ? 'bg-amber-100 text-amber-800' :
                          f.statut === 'en_cours' ? 'bg-emerald-100 text-emerald-800' :
                          f.statut === 'terminee' ? 'bg-sky-100 text-sky-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {f.statut === 'planifiee' ? 'Planifiée' : f.statut === 'en_cours' ? 'En cours' : f.statut === 'terminee' ? 'Terminée' : 'Annulée'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
