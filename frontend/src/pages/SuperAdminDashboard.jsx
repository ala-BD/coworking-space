import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../services/superAdminApi';
import { supabase } from '../supabaseClient';
import PortalLayout from '../components/layout/PortalLayout';

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
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [navigate]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#f4f6f9' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Coworkings', value: stats?.totalTenants ?? 0, icon: 'domain', color: '#0054cb', bg: 'rgba(0,84,203,0.08)' },
    { label: 'MRR Total', value: `${(stats?.mrr || 0).toLocaleString('fr-TN')} DT`, icon: 'payments', color: '#000d23', bg: 'rgba(0,13,35,0.06)' },
    { label: 'Total Membres', value: stats?.totalMembers ?? 0, icon: 'groups', color: '#2FBE8F', bg: 'rgba(47,190,143,0.08)' },
    { label: 'Coworkings Actifs', value: stats?.activeTenants ?? 0, icon: 'check_circle', color: '#2FBE8F', bg: 'rgba(47,190,143,0.08)' },
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
          <div key={i} className="bento-card bg-white rounded-2xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)] hover:shadow-[0px_8px_16px_rgba(16,35,63,0.08)] transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{c.label}</span>
              <span className="material-symbols-outlined p-2 rounded-xl" style={{ fontSize: 20, color: c.color, background: c.bg }}>{c.icon}</span>
            </div>
            <p className="font-sora text-3xl font-bold text-primary">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
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
                <p className="text-sm font-semibold text-primary">Revenus récurrents mensuels</p>
                <p className="text-xs text-on-surface-variant">MRR stable et croissant</p>
              </div>
              <span className="font-sora font-bold text-secondary">{(stats?.mrr || 0).toLocaleString('fr-TN')} DT</span>
            </div>
            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-[#2FBE8F]" style={{ fontSize: 24 }}>trending_up</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">Coworkings actifs</p>
                <p className="text-xs text-on-surface-variant">{stats?.activeTenants || 0} sur {stats?.totalTenants || 0} coworkings</p>
              </div>
              <span className="font-sora font-bold text-[#2FBE8F]">{stats?.totalTenants ? Math.round((stats.activeTenants / stats.totalTenants) * 100) : 0}%</span>
            </div>
            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-[#FFB020]" style={{ fontSize: 24 }}>warning</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">Coworkings suspendus</p>
                <p className="text-xs text-on-surface-variant">Nécessitent une attention</p>
              </div>
              <span className="font-sora font-bold text-[#FFB020]">{stats?.suspendedTenants || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-primary-container rounded-2xl p-6 text-white">
          <h2 className="font-sora text-lg font-semibold mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <button onClick={() => navigate('/super-admin/tenants')} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_business</span>
              Créer un Coworking
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
    </PortalLayout>
  );
}
