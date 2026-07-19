import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const STATUT_STYLES = {
  paid: 'bg-[#D1FAE5] text-[#065F46]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  failed: 'bg-[#FEE2E2] text-[#991B1B]',
  refunded: 'bg-[#EDE9FE] text-[#5B21B6]',
};

const STATUT_LABELS = {
  paid: 'Payé',
  pending: 'À payer',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

export default function MemberPayments({ session }) {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [payingId, setPayingId] = useState(null);

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
      setErrorMsg(err.message || "Erreur de chargement");
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
      alert("Erreur lors du téléchargement du PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="mb-lg">
        <h1 className="font-sora text-headline-md font-bold text-primary mb-xs">Mes Factures</h1>
        <p className="text-body-md text-on-surface-variant">Consultez et réglez vos paiements en attente (Stripe).</p>
      </div>

      {errorMsg && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {payments.length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-lg rounded-2xl text-center text-on-surface-variant">
            Aucun paiement trouvé sur votre compte.
          </div>
        ) : (
          payments.map(p => {
            const dateP = p.date_paiement ? new Date(p.date_paiement) : new Date(p.created_at);
            return (
              <div key={p.id} className="bg-surface-container-lowest p-md rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUT_STYLES[p.statut] || 'bg-gray-200 text-gray-800'}`}>
                        {STATUT_LABELS[p.statut] || p.statut}
                      </span>
                      <p className="font-mono text-sm text-primary mt-2">Ref: {p.numero_recu || '—'}</p>
                      <p className="text-xs text-on-surface-variant">{dateP.toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-headline-sm font-bold text-secondary">{p.montant} DT</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface mb-4">
                    {p.reservations ? `Réservation Espace : ${p.reservations.espaces?.nom || '—'}` : ''}
                    {p.abonnements ? `Abonnement : ${p.abonnements.type}` : ''}
                    {!p.reservations && !p.abonnements ? 'Frais divers' : ''}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-outline-variant/20">
                  {p.statut === 'pending' ? (
                    <button 
                      onClick={() => handlePayStripe(p.id)}
                      disabled={payingId === p.id}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {payingId === p.id ? (
                        <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">credit_card</span>
                      )}
                      Payer en ligne
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleDownload(p.id)}
                      className="flex-1 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg font-semibold hover:bg-primary/10 transition-colors flex justify-center items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Télécharger Reçu
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </PortalLayout>
  );
}
