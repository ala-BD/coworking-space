import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { memberApi, pricingApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const SUBSCRIPTION_LABELS = {
  day_pass: 'Day Pass',
  week_pass: 'Week Pass',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  bureau_prive: 'Bureau privé',
};

const PLAN_LABELS = {
  standard: 'Standard',
  etudiant: 'Étudiant',
  entreprise: 'Entreprise',
};

export default function MemberSubscription({ session }) {
  const [profile, setProfile] = useState(null);
  const [tarifs, setTarifs] = useState([]);
  const [planTarifaire, setPlanTarifaire] = useState('standard');
  const [history, setHistory] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [{ profile: prof }, pricing] = await Promise.all([
        memberApi.getMe(),
        pricingApi.getPlans(),
      ]);
      setProfile(prof);
      setPlanTarifaire(pricing.plan_tarifaire);
      setTarifs(pricing.tarifs || []);
    } catch (e) {
      if (e.message.includes('Session expirée')) {
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      setError(e.message);
      setLoading(false);
      return;
    }

    try {
      const hist = await pricingApi.getMyHistory();
      setHistory(hist.history || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleValidatePromo = async (typeAbonnement) => {
    if (!promoCode.trim()) {
      setError('Saisissez un code promo.');
      return;
    }
    setValidating(true);
    setError('');
    setPromoResult(null);
    setSelectedType(typeAbonnement);
    try {
      const result = await pricingApi.validatePromo({
        code: promoCode.trim(),
        type_abonnement: typeAbonnement,
        plan_tarifaire: planTarifaire,
      });
      setPromoResult(result);
    } catch (e) {
      if (e.message.includes('Session expirée')) {
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      setError(e.message);
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <header className="mb-lg">
        <h1 className="font-sora text-headline-lg text-primary">Abonnements & tarifs</h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Module A — Semaine S2 · Plan {PLAN_LABELS[planTarifaire] || planTarifaire} (selon votre type membre)
        </p>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8 space-y-md">
          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
            <h2 className="font-sora text-headline-sm text-primary mb-md">Grille tarifaire</h2>
            {tarifs.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                Tarifs non configurés. Exécutez la migration{' '}
                <code className="text-xs bg-surface-container-high px-1 rounded">s2_dev1_tarifs_promo.sql</code>{' '}
                dans Supabase.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-md">
                {tarifs.map((tarif) => (
                  <div
                    key={tarif.id}
                    className={`rounded-xl border p-md ${
                      selectedType === tarif.type_abonnement
                        ? 'border-secondary bg-secondary-fixed/30'
                        : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-sm">
                      <h3 className="font-sora font-semibold text-primary">
                        {SUBSCRIPTION_LABELS[tarif.type_abonnement] || tarif.label}
                      </h3>
                      {tarif.duree_jours && (
                        <span className="text-label-sm text-on-surface-variant">{tarif.duree_jours} j</span>
                      )}
                    </div>
                    <p className="font-sora text-headline-sm text-secondary mb-xs">
                      {Number(tarif.prix).toFixed(2)} DT
                      <span className="text-body-sm text-on-surface-variant font-normal"> TTC</span>
                    </p>
                    <p className="text-body-xs text-on-surface-variant mb-sm">TVA {tarif.tva_pct}%</p>
                    <button
                      type="button"
                      onClick={() => handleValidatePromo(tarif.type_abonnement)}
                      disabled={validating || !promoCode.trim()}
                      className="text-label-sm font-semibold text-secondary hover:underline disabled:opacity-50"
                    >
                      Appliquer le code promo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
            <h2 className="font-sora text-headline-sm text-primary mb-md">Historique des tarifs appliqués</h2>
            {history.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Aucun tarif enregistré pour le moment.</p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {history.map((item) => (
                  <div key={item.id} className="py-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                    <div>
                      <p className="font-semibold text-primary">
                        {SUBSCRIPTION_LABELS[item.type_abonnement] || item.type_abonnement}
                        {' · '}
                        {PLAN_LABELS[item.plan_tarifaire] || item.plan_tarifaire}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                        {item.codes_promo?.code ? ` · Code ${item.codes_promo.code}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.prix_initial !== item.prix_final && (
                        <p className="text-body-sm text-on-surface-variant line-through">
                          {Number(item.prix_initial).toFixed(2)} DT
                        </p>
                      )}
                      <p className="font-sora font-bold text-secondary">{Number(item.prix_final).toFixed(2)} DT</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-md">
          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
            <h2 className="font-sora text-headline-sm text-primary mb-md">Code promo</h2>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Ex: WELCOME10"
              className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs mb-sm uppercase"
            />
            <p className="text-body-xs text-on-surface-variant">
              Sélectionnez un abonnement puis cliquez « Appliquer le code promo » pour voir le prix réduit.
            </p>

            {promoResult?.valid && (
              <div className="mt-md p-sm bg-secondary-fixed text-on-secondary-fixed rounded-xl text-body-sm space-y-xs">
                <p className="font-semibold">Code {promoResult.code} appliqué</p>
                <p>Prix initial : {promoResult.prix_initial.toFixed(2)} DT</p>
                <p>Réduction : −{promoResult.reduction.toFixed(2)} DT</p>
                <p className="font-bold text-base">Prix final : {promoResult.prix_final.toFixed(2)} DT</p>
              </div>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant/20">
            <div className="flex gap-sm items-start">
              <span className="material-symbols-outlined text-secondary">info</span>
              <p className="text-body-sm text-on-surface-variant">
                La souscription effective est créée par un admin/staff via l&apos;API avec le code promo.
                Le paiement est géré par Dev 2 (Module C).
              </p>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
