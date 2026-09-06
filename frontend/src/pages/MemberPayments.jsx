import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { exportPaymentsToExcel } from '../utils/exportPaymentsExcel';

const PER_PAGE = 5;

const STATUS_CONFIG = {
  paid: {
    label: 'Payée',
    bg: 'bg-[#2FBE8F]/10',
    text: 'text-[#2FBE8F]',
  },
  pending: {
    label: 'En attente',
    bg: 'bg-[#FFB020]/10',
    text: 'text-[#FFB020]',
  },
  failed: {
    label: 'Échouée',
    bg: 'bg-[#FF6F59]/10',
    text: 'text-[#FF6F59]',
  },
  refunded: {
    label: 'Remboursée',
    bg: 'bg-[#8B5CF6]/10',
    text: 'text-[#8B5CF6]',
  },
};

const FILTER_TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'paid', label: 'Payées' },
  { key: 'pending', label: 'En attente' },
  { key: 'failed', label: 'Échouées' },
];

const PAYMENT_METHOD_ICONS = {
  card: 'credit_card',
  stripe: 'credit_card',
  bank_transfer: 'account_balance',
  virement: 'account_balance',
  paypal: 'account_balance_wallet',
  cash: 'payments',
};

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DT';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function generateRef(payment) {
  if (payment.numero_recu) return payment.numero_recu;
  const d = new Date(payment.date_paiement || payment.created_at);
  const year = d.getFullYear();
  const seq = String(payment.id).slice(-4).padStart(4, '0');
  return `REF-${year}-${seq}`;
}

export default function MemberPayments({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [payingId, setPayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profErr) throw profErr;
      setProfile(prof);

      const res = await paymentApi.getMemberPayments(session.user.id);
      setPayments(res.payments || []);
    } catch (err) {
      setErrorMsg(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handlePayStripe = async (paymentId) => {
    try {
      setPayingId(paymentId);
      setErrorMsg('');
      const res = await paymentApi.payWithStripe(paymentId);
      if (res.link) {
        window.location.href = res.link;
      } else {
        throw new Error('Lien de paiement non reçu.');
      }
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'initialisation du paiement.");
      setPayingId(null);
    }
  };

  const handleDownload = async (id) => {
    try {
      await paymentApi.downloadReceipt(id);
    } catch (err) {
      alert('Erreur lors du téléchargement du PDF');
    }
  };

  /* ── Derived data ── */
  const filteredPayments = useMemo(() => {
    let result = [...payments];
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.statut === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          generateRef(p).toLowerCase().includes(q) ||
          formatDate(p.date_paiement || p.created_at).toLowerCase().includes(q) ||
          (p.mode_paiement || '').toLowerCase().includes(q) ||
          String(p.montant).includes(q)
      );
    }
    return result;
  }, [payments, activeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPayments = filteredPayments.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const stats = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearPaid = payments
      .filter((p) => p.statut === 'paid' && new Date(p.date_paiement || p.created_at) >= yearStart)
      .reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
    const pendingTotal = payments
      .filter((p) => p.statut === 'pending')
      .reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
    const nextPending = payments
      .filter((p) => p.statut === 'pending')
      .sort((a, b) => new Date(a.date_paiement || a.created_at) - new Date(b.date_paiement || b.created_at))[0];
    const nextDate = nextPending ? formatDate(nextPending.date_paiement || nextPending.created_at) : 'Aucune';
    return { yearPaid, pendingTotal, nextDate };
  }, [payments]);

  const handleFilterChange = (key) => {
    setActiveFilter(key);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleExport = () => {
    exportPaymentsToExcel(filteredPayments.length > 0 ? filteredPayments : payments);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f95d00]" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      {/* ══════════════════════════════════════════
          ERROR BANNER
          ══════════════════════════════════════════ */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-[#FF6F59]/10 text-[#FF6F59] text-sm rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          {errorMsg}
          <button onClick={() => setErrorMsg('')} className="ml-auto">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          PAGE HEADER
          ══════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="font-[Sora] text-2xl md:text-[28px] leading-[36px] font-semibold text-[#000d23] tracking-[-0.01em]">
            Mes Factures
          </h1>
          <p className="text-[16px] leading-[24px] text-[#44474d]">
            Gérez votre historique de facturation et téléchargez vos reçus.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f95d00] text-white rounded-xl font-semibold text-sm hover:shadow-lg active:scale-[0.97] transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
          Télécharger tout
        </button>
      </div>

      {/* ══════════════════════════════════════════
          FINANCIAL HIGHLIGHTS BENTO
          ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Total dépensé YTD */}
        <div className="bg-white p-6 rounded-2xl shadow-[0px_2px_4px_rgba(16,35,63,0.04)] border border-[#c5c6ce]/10">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#44474d] text-xs font-medium uppercase tracking-[0.08em]">
              Total dépensé (année)
            </span>
            <span className="material-symbols-outlined text-[#f95d00]">payments</span>
          </div>
          <p className="font-[Sora] text-[28px] leading-[36px] font-semibold text-[#000d23] tracking-[-0.01em]">
            {formatCurrency(stats.yearPaid)}
          </p>
        </div>

        {/* Montant en attente */}
        <div className="bg-white p-6 rounded-2xl shadow-[0px_2px_4px_rgba(16,35,63,0.04)] border border-[#c5c6ce]/10">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#44474d] text-xs font-medium uppercase tracking-[0.08em]">
              Montant en attente
            </span>
            <span className="material-symbols-outlined text-[#FF6F59]">pending_actions</span>
          </div>
          <p className="font-[Sora] text-[28px] leading-[36px] font-semibold text-[#FFB020] tracking-[-0.01em]">
            {formatCurrency(stats.pendingTotal)}
          </p>
        </div>

        {/* Prochaine facture */}
        <div className="bg-white p-6 rounded-2xl shadow-[0px_2px_4px_rgba(16,35,63,0.04)] border border-[#c5c6ce]/10">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#44474d] text-xs font-medium uppercase tracking-[0.08em]">
              Prochaine facture
            </span>
            <span className="material-symbols-outlined text-[#10233f]">calendar_month</span>
          </div>
          <p className="font-[Sora] text-[28px] leading-[36px] font-semibold text-[#000d23] tracking-[-0.01em]">
            {stats.nextDate}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SEARCH & FILTER BAR
          ══════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-5">
        {/* Search input */}
        <div className="relative flex-1 w-full md:max-w-sm">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777e]"
            style={{ fontSize: 20 }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher une facture..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#c5c6ce]/30 bg-white text-sm text-[#1b1b1e] placeholder:text-[#75777e] focus:outline-none focus:ring-2 focus:ring-[#f95d00]/30 focus:border-[#f95d00] transition-all"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeFilter === tab.key
                  ? 'bg-[#f95d00] text-white shadow-sm'
                  : 'bg-white text-[#44474d] border border-[#c5c6ce]/30 hover:border-[#f95d00]/30 hover:text-[#f95d00]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          INVOICE TABLE
          ══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-[0px_8px_16px_rgba(16,35,63,0.08)] overflow-hidden border border-[#c5c6ce]/10">
        {filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#c5c6ce] mb-3 block">receipt_long</span>
            <p className="text-[#44474d] text-sm">
              {searchQuery || activeFilter !== 'all'
                ? 'Aucune facture ne correspond à votre recherche.'
                : 'Aucun paiement trouvé sur votre compte.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#000d23]">
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white">Date</th>
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white">Référence</th>
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white">Montant</th>
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white">Mode de paiement</th>
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white">Statut</th>
                    <th className="px-6 py-4 text-xs font-medium uppercase tracking-[0.08em] text-white text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c5c6ce]/10">
                  {paginatedPayments.map((p) => {
                    const statusCfg = STATUS_CONFIG[p.statut] || STATUS_CONFIG.paid;
                    const isPaid = p.statut === 'paid' || p.statut === 'refunded';
                    const isPending = p.statut === 'pending';
                    const isFailed = p.statut === 'failed';
                    const methodKey = (p.mode_paiement || 'card').toLowerCase().replace(/\s+/g, '_');
                    const methodIcon = PAYMENT_METHOD_ICONS[methodKey] || 'credit_card';
                    const methodLabel = p.mode_paiement || 'Carte bancaire';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#f5f3f6] transition-colors group"
                      >
                        <td className="px-6 py-4 text-sm text-[#1b1b1e]">
                          {formatDate(p.date_paiement || p.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-[#f95d00]">
                            {generateRef(p)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-[#1b1b1e]">
                            {formatCurrency(p.montant)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#44474d]" style={{ fontSize: 18 }}>
                              {methodIcon}
                            </span>
                            <span className="text-[13px] text-[#44474d]">{methodLabel}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(isPaid || isFailed) && (
                              <button
                                onClick={() => handleDownload(p.id)}
                                className="p-2 text-[#44474d] hover:text-[#f95d00] hover:bg-[#f95d00]/5 rounded-full transition-all"
                                title="Télécharger le reçu"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                              </button>
                            )}
                            {isPending && (
                              <button
                                onClick={() => handlePayStripe(p.id)}
                                disabled={payingId === p.id}
                                className="px-4 py-1.5 text-sm font-semibold border border-[#FF6F59] text-[#FF6F59] rounded-lg hover:bg-[#FF6F59]/5 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center gap-1.5"
                              >
                                {payingId === p.id ? (
                                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>sync</span>
                                ) : (
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>credit_card</span>
                                )}
                                Payer maintenant
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ══════════════════════════════════════════
                PAGINATION
                ══════════════════════════════════════════ */}
            <div className="px-6 py-4 border-t border-[#c5c6ce]/10 flex justify-between items-center bg-[#f5f3f6]">
              <p className="text-sm text-[#44474d]">
                Affichage {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filteredPayments.length)} sur{' '}
                {filteredPayments.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-2 border border-[#c5c6ce]/30 rounded-lg hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-2 border border-[#c5c6ce]/30 rounded-lg hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          SUPPORT CTA
          ══════════════════════════════════════════ */}
      <div className="mt-8 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-[#f95d00]/10"
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex gap-4 items-center text-center md:text-left">
          <div className="w-12 h-12 bg-[#f95d00]/10 rounded-full flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#f95d00]">support_agent</span>
          </div>
          <div>
            <p className="font-[Sora] text-base font-semibold text-[#000d23]">
              Besoin d'aide avec une facture ?
            </p>
            <p className="text-sm text-[#44474d] mt-0.5">
              Notre équipe support est disponible pour répondre à vos questions 7j/7.
            </p>
          </div>
        </div>
        <a
          href="mailto:contact@deskywork.tn"
          className="px-6 py-2.5 border border-[#f95d00] text-[#f95d00] rounded-xl font-semibold text-sm hover:bg-[#f95d00]/5 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          Contacter le support
        </a>
      </div>
    </PortalLayout>
  );
}
