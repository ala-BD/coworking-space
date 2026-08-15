import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../services/superAdminApi';
import { supabase } from '../supabaseClient';
import PortalLayout from '../components/layout/PortalLayout';

const PLAN_LABELS = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
const STATUT_STYLES = {
  actif: 'bg-[#2fbe8f1a] text-[#2fbe8f]',
  suspendu: 'bg-[#ff6f591a] text-[#ff6f59]',
  inactif: 'bg-surface-container text-on-surface-variant',
};
const STATUT_LABELS = { actif: 'Payé', suspendu: 'Suspendu', inactif: 'Inactif' };

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN'];

export default function TenantBilling({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0 });
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await superAdminApi.getTenants({ page, limit: 10 });
      setTenants(data.tenants || []);
      setPagination(data.pagination || { total: 0 });
      const s = await superAdminApi.getStats();
      setStats(s);
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

  const mrr = (tenants || []).filter(t => t.statut === 'actif').reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);
  const unpaid = (tenants || []).filter(t => t.statut === 'suspendu').reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);

  if (loading || !profile) {
    return <div className="flex h-screen items-center justify-center" style={{ background: '#f4f6f9' }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" /></div>;
  }

  const barData = [32000, 35500, 38200, 41000, 43800, mrr || 45200];
  const maxBar = Math.max(...barData);

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold text-primary">Facturation B2B</h1>
        <p className="text-on-surface-variant text-sm mt-1">Suivi des abonnements mensuels des coworkings clients</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'MRR Total', value: `${mrr.toLocaleString('fr-TN')} DT`, icon: 'payments', color: '#0054cb', sub: '+2.4% vs dernier mois' },
          { label: 'Tenants Actifs', value: stats?.activeTenants ?? 0, icon: 'person_pin', color: '#0054cb', sub: `${stats?.suspendedTenants || 0} suspendus` },
          { label: 'Impayés B2B', value: `${unpaid.toLocaleString('fr-TN')} DT`, icon: 'warning', color: '#FF6F59', sub: 'Nécessite une action' },
          { label: 'Croissance MRR', value: '+12.5%', icon: 'trending_up', color: '#2FBE8F', sub: 'Objectif atteint' },
        ].map((c, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-3xl p-5 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{c.label}</span>
              <span className="material-symbols-outlined p-2 rounded-xl" style={{ fontSize: 18, color: c.color, background: `${c.color}12` }}>{c.icon}</span>
            </div>
            <p className="font-sora text-2xl font-bold text-primary">{c.value}</p>
            <p className="text-xs text-on-surface-variant mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-sora text-base font-semibold text-primary">Évolution MRR (6 mois)</h2>
            <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant/30 hover:bg-surface-container-low text-on-surface-variant">Export CSV</button>
          </div>
          <div className="flex items-end gap-3 h-48">
            {barData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-on-surface-variant">{(val / 1000).toFixed(0)}k</span>
                <div className="w-full rounded-t-lg transition-all" style={{ height: `${(val / maxBar) * 100}%`, background: i === barData.length - 1 ? '#0054cb' : 'rgba(0,84,203,0.2)' }} />
                <span className={`text-xs font-semibold ${i === barData.length - 1 ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0px_2px_4px_rgba(16,35,63,0.04)]">
          <h2 className="font-sora text-base font-semibold text-primary mb-1">Relances automatiques</h2>
          <p className="text-xs text-on-surface-variant mb-5">Paramétrez les alertes automatiques pour les factures en retard.</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>mail</span>
                <div>
                  <p className="text-sm font-semibold text-primary">Alertes Email</p>
                  <p className="text-xs text-on-surface-variant">Envoyé à J+3, J+7, J+15</p>
                </div>
              </div>
              <button onClick={() => setEmailAlerts(!emailAlerts)} className={`relative w-11 h-6 rounded-full transition-colors ${emailAlerts ? 'bg-secondary' : 'bg-surface-variant'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${emailAlerts ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>sms</span>
                <div>
                  <p className="text-sm font-semibold text-primary">Alertes SMS</p>
                  <p className="text-xs text-on-surface-variant">Urgent: envoyé à J+15 uniquement</p>
                </div>
              </div>
              <button onClick={() => setSmsAlerts(!smsAlerts)} className={`relative w-11 h-6 rounded-full transition-colors ${smsAlerts ? 'bg-secondary' : 'bg-surface-variant'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${smsAlerts ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-secondary text-secondary hover:bg-secondary/5 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
            Personnaliser les templates
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl shadow-[0px_16px_32px_rgba(16,35,63,0.12)] overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/15">
          <h2 className="font-sora text-base font-semibold text-primary">Suivi des Facturations Tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-container text-white">
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Tenant</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Offre</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Montant mensuel</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Créé le</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Statut</th>
                <th className="px-5 py-3.5 text-left font-semibold uppercase tracking-wider text-xs">Prochaine échéance</th>
                <th className="px-5 py-3.5 text-right font-semibold uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low/50 transition-colors group" style={{ borderLeft: '4px solid transparent' }} onMouseEnter={(e) => e.currentTarget.style.borderLeftColor = '#0054cb'} onMouseLeave={(e) => e.currentTarget.style.borderLeftColor = 'transparent'}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center font-sora font-bold text-secondary text-xs">{(t.nom || '?')[0]}</div>
                      <span className="font-semibold text-primary">{t.nom}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${t.plan === 'pro' ? 'bg-secondary/10 text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>{PLAN_LABELS[t.plan] || t.plan}</span></td>
                  <td className="px-5 py-4"><span className="font-semibold text-primary">{parseFloat(t.montant_mensuel || 0).toLocaleString('fr-TN')} DT</span></td>
                  <td className="px-5 py-4"><span className="text-on-surface-variant">{new Date(t.created_at).toLocaleDateString('fr-TN')}</span></td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUT_STYLES[t.statut] || ''}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{STATUT_LABELS[t.statut] || t.statut}</span></td>
                  <td className="px-5 py-4"><span className={`text-sm font-semibold ${t.statut === 'suspendu' ? 'text-[#ff6f59]' : 'text-primary'}`}>{t.prochaine_echeance ? new Date(t.prochaine_echeance).toLocaleDateString('fr-TN') : '—'}</span></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.statut === 'suspendu' ? (
                        <button onClick={async () => { await superAdminApi.updateTenant(t.id, { statut: 'actif' }); load(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-white hover:bg-secondary/90">Réactiver</button>
                      ) : t.statut === 'actif' ? (
                        <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant" title="Reçu"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span></button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-on-surface-variant">Aucun tenant trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant/15">
          <span className="text-xs text-on-surface-variant">Affichage de {tenants.length > 0 ? ((page - 1) * 10 + 1) : 0}–{Math.min(page * 10, pagination.total)} sur {pagination.total} tenants</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold disabled:opacity-40 hover:bg-surface-container-low">Précédent</button>
            <span className="text-xs font-semibold text-secondary px-2 bg-secondary/10 rounded-lg py-1">{page}</span>
            <button disabled={tenants.length < 10} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold disabled:opacity-40 hover:bg-surface-container-low">Suivant</button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
