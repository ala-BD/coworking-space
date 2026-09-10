import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import Pagination from '../components/Pagination';
import { exportPaymentsToExcel } from '../utils/exportPaymentsExcel';

const ITEMS_PER_PAGE = 10;

const STATUT_STYLES = {
  paid: 'bg-[#D1FAE5] text-[#065F46]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  failed: 'bg-[#FEE2E2] text-[#991B1B]',
  refunded: 'bg-[#EDE9FE] text-[#5B21B6]',
};

const STATUT_LABELS = {
  paid: 'Payé',
  pending: 'En attente',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

const FILTER_TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'paid', label: 'Payés' },
  { key: 'pending', label: 'En attente' },
  { key: 'failed', label: 'Échoués' },
  { key: 'refunded', label: 'Remboursés' },
];

const MODE_LABELS = {
  cash: 'Espèces',
  bank_transfer: 'Virement',
  check: 'Chèque',
  online: 'En ligne',
};

function computePaymentStats(payments) {
  const stats = {
    totalRevenue: payments.filter(p => p.statut === 'paid').reduce((sum, p) => sum + parseFloat(p.montant || 0), 0),
    pendingAmount: payments.filter(p => p.statut === 'pending').reduce((sum, p) => sum + parseFloat(p.montant || 0), 0),
    paidCount: payments.filter(p => p.statut === 'paid').length,
    pendingCount: payments.filter(p => p.statut === 'pending').length,
  };
  const totalInvoices = stats.paidCount + stats.pendingCount;
  const recoveryRate = totalInvoices > 0 ? Math.round((stats.paidCount / totalInvoices) * 100) : 0;
  return { stats, totalInvoices, recoveryRate };
}

export default function AdminPayments({ session }) {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredPayments = useMemo(() => {
    let result = [...payments];
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.statut === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const memberName = p.profiles ? `${p.profiles.prenom} ${p.profiles.nom}`.toLowerCase() : '';
        const recu = (p.numero_recu || '').toLowerCase();
        const mode = (MODE_LABELS[p.mode] || p.mode || '').toLowerCase();
        const montant = String(p.montant || '');
        const dateStr = p.date_paiement ? new Date(p.date_paiement).toLocaleDateString('fr-FR') : '';
        return (
          memberName.includes(q) ||
          recu.includes(q) ||
          mode.includes(q) ||
          montant.includes(q) ||
          dateStr.includes(q)
        );
      });
    }
    return result;
  }, [payments, activeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPayments = filteredPayments.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // États supprimés : pas de modification permise pour l'admin (lecture seule)

  useEffect(() => {
    fetchProfileAndPayments();
  }, []);

  const fetchProfileAndPayments = async () => {
    try {
      setLoading(true);
      // Récupérer le profil
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profErr) throw profErr;
      setProfile(prof);

      // Si pas admin/staff, rediriger ou afficher erreur
      if (!['super_admin', 'admin', 'staff'].includes(prof.role)) {
        throw new Error("Accès non autorisé.");
      }

      // Récupérer les paiements via l'API (qui gère la sécurité et les jointures)
      const data = await paymentApi.getAll();
      setPayments(data.payments || []);

    } catch (err) {
      setErrorMsg(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDownload = async (id) => {
    try {
      await paymentApi.downloadReceipt(id);
    } catch (err) {
      alert("Erreur lors du téléchargement du PDF");
    }
  };

  const handleExportExcel = async () => {
    if (!payments || payments.length === 0) return;

    try {
      const { stats, totalInvoices, recoveryRate } = computePaymentStats(payments);
      await exportPaymentsToExcel(payments, {
        totalRevenue: stats.totalRevenue,
        pendingAmount: stats.pendingAmount,
        recoveryRate,
        paidCount: stats.paidCount,
        totalInvoices,
      });
    } catch (err) {
      alert('Erreur lors de l\'export Excel.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  const { stats, totalInvoices, recoveryRate } = computePaymentStats(payments);

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="mb-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sora text-headline-md font-bold text-primary mb-xs">Gestion des Paiements</h1>
          <p className="text-body-md text-on-surface-variant">Consultez et téléchargez les reçus des transactions.</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={payments.length === 0}
          className="flex items-center gap-xs px-4 py-2 bg-secondary text-on-secondary rounded-lg font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          Exporter Excel
        </button>
      </div>

      {/* Cartes de statistiques (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-lg">
        <div className="bg-surface-container-lowest p-md rounded-3xl border border-outline-variant/30 shadow-sm flex items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center">
            <span className="material-symbols-outlined filled text-[24px]">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider mb-1">Recettes Encaissées</p>
            <p className="text-headline-sm font-bold text-primary">{stats.totalRevenue.toLocaleString()} DT</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-md rounded-3xl border border-outline-variant/30 shadow-sm flex items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center">
            <span className="material-symbols-outlined filled text-[24px]">pending_actions</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider mb-1">Paiements en Attente</p>
            <p className="text-headline-sm font-bold text-primary">{stats.pendingAmount.toLocaleString()} DT</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-md rounded-3xl border border-outline-variant/30 shadow-sm flex items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined filled text-[24px]">monitoring</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider mb-1">Taux de Recouvrement</p>
            <div className="flex items-end gap-2">
              <p className="text-headline-sm font-bold text-primary">{recoveryRate}%</p>
              <p className="text-label-sm text-on-surface-variant mb-1">({stats.paidCount}/{totalInvoices})</p>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Barre de recherche et filtres de statut */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 border border-outline-variant/30 shadow-sm mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Champ de recherche clair */}
          <div className="relative flex-1 max-w-lg">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
              style={{ fontSize: 20 }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher par membre, référence, mode, montant..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-body-sm text-primary placeholder:text-on-surface-variant/70 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary p-0.5 rounded-full hover:bg-surface-container transition-colors"
                title="Effacer la recherche"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            )}
          </div>
        </div>

        {/* Boutons de filtres avec compteurs */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-outline-variant/15">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mr-1 hidden sm:inline">
            Statut :
          </span>
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? payments.length
              : payments.filter((p) => p.statut === tab.key).length;
            const isActive = activeFilter === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => { setActiveFilter(tab.key); setCurrentPage(1); }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#f95d00] text-white shadow-md shadow-[#f95d00]/25 ring-2 ring-[#f95d00]/30'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-outline-variant/30 text-on-surface-variant'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau des paiements */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/30 text-label-sm uppercase text-on-surface-variant tracking-wider">
                <th className="px-md py-sm font-semibold">Membre</th>
                <th className="px-md py-sm font-semibold">Référence / Date</th>
                <th className="px-md py-sm font-semibold">Montant</th>
                <th className="px-md py-sm font-semibold">Mode</th>
                <th className="px-md py-sm font-semibold">Statut</th>
                <th className="px-md py-sm font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-body-sm">
              {paginatedPayments.map((p) => {
                const memberName = p.profiles ? `${p.profiles.prenom} ${p.profiles.nom}` : (p.user_id ? p.user_id.slice(0, 8) : '—');
                const dateP = p.date_paiement ? new Date(p.date_paiement) : new Date(p.created_at);

                return (
                  <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-md py-md font-semibold text-primary">
                      {memberName}
                    </td>
                    <td className="px-md py-md text-on-surface-variant">
                      <div className="font-mono text-xs mb-0.5 text-primary">{p.numero_recu || '—'}</div>
                      <div className="text-[11px]">{dateP.toLocaleDateString()}</div>
                    </td>
                    <td className="px-md py-md font-bold text-secondary">
                      {p.montant} DT
                    </td>
                    <td className="px-md py-md">
                      <span className="bg-surface-container-high px-2 py-1 rounded-md text-xs font-medium">
                        {MODE_LABELS[p.mode] || p.mode}
                      </span>
                    </td>
                    <td className="px-md py-md">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUT_STYLES[p.statut] || 'bg-gray-200 text-gray-800'}`}>
                        {STATUT_LABELS[p.statut] || p.statut}
                      </span>
                    </td>
                    <td className="px-md py-md text-right">
                      <button
                        onClick={() => handleDownload(p.id)}
                        className="p-1.5 text-on-surface-variant hover:text-secondary hover:bg-secondary/10 rounded transition-colors"
                        title="Télécharger le reçu PDF"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-md py-xl text-center text-on-surface-variant">
                    {searchQuery || activeFilter !== 'all'
                      ? 'Aucun paiement ne correspond aux critères de recherche.'
                      : 'Aucun paiement trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination 10 par page */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredPayments.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          label="paiements"
        />
      </div>

    </PortalLayout>
  );
}
