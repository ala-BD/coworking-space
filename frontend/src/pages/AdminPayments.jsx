import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { exportPaymentsToExcel } from '../utils/exportPaymentsExcel';

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

  // Modal state
  const [editingPayment, setEditingPayment] = useState(null);
  const [editStatut, setEditStatut] = useState('');
  const [editMode, setEditMode] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const handleOpenEdit = (payment) => {
    setEditingPayment(payment);
    setEditStatut(payment.statut);
    setEditMode(payment.mode || 'cash');
  };

  const handleCloseEdit = () => {
    setEditingPayment(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setErrorMsg('');
    try {
      await paymentApi.update(editingPayment.id, {
        statut: editStatut,
        mode: editMode,
      });

      // Rafraîchir la liste
      await fetchProfileAndPayments();
      handleCloseEdit();
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setProcessing(false);
    }
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
          <p className="text-body-md text-on-surface-variant">Visualisez et mettez à jour les transactions (Module C).</p>
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
              {payments.map((p) => {
                // Pour récupérer le nom, l'API retourne profiles avec nom/prenom (si on a fait le bon select)
                // Comme l'API existante n'a pas forcément le join dans getAll(), on va s'adapter.
                // Normalement l'API /api/payments devrait faire un .select('*, profiles(nom,prenom)')
                const memberName = p.profiles ? `${p.profiles.prenom} ${p.profiles.nom}` : p.user_id.slice(0, 8);
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
                    <td className="px-md py-md text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Modifier le statut"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
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

              {payments.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-md py-xl text-center text-on-surface-variant">
                    Aucun paiement trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'édition */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-[400px] max-w-[90vw] overflow-hidden shadow-2xl">
            <div className="px-lg py-md border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low">
              <h3 className="font-sora font-semibold text-primary">Mettre à jour le paiement</h3>
              <button onClick={handleCloseEdit} className="text-on-surface-variant hover:text-error transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-lg space-y-md">
              <div className="bg-surface-container px-sm py-xs rounded-lg text-body-sm font-mono text-primary mb-md text-center">
                Ref: {editingPayment.numero_recu || editingPayment.id.slice(0, 8)} — {editingPayment.montant} DT
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Mode de paiement</label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-xl px-sm py-2 text-body-md focus:border-secondary outline-none"
                >
                  <option value="cash">Espèces</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="check">Chèque</option>
                  <option value="online">En ligne</option>
                </select>
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface mb-1">Statut</label>
                <select
                  value={editStatut}
                  onChange={(e) => setEditStatut(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-xl px-sm py-2 text-body-md focus:border-secondary outline-none"
                >
                  <option value="pending">En attente</option>
                  <option value="paid">Payé</option>
                  <option value="failed">Échoué</option>
                  <option value="refunded">Remboursé</option>
                </select>
                {editStatut === 'paid' && editingPayment.statut !== 'paid' && (
                  <p className="mt-2 text-xs text-secondary font-medium">
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">mail</span>
                    Un email contenant le reçu PDF sera automatiquement envoyé au membre.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-sm pt-4">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 rounded-lg font-semibold text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-label-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processing && <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </PortalLayout>
  );
}
