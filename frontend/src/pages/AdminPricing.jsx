import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { pricingApi, bookingApi } from '../services/api';
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

export default function AdminPricing({ session }) {
  const [profile, setProfile] = useState(null);
  const [tarifs, setTarifs] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [occupation, setOccupation] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('tarifs');
  const navigate = useNavigate();

  const [newTarif, setNewTarif] = useState({
    type_abonnement: 'mensuel',
    plan_tarifaire: 'standard',
    prix: '',
    tva_pct: '19',
  });

  const [newPromo, setNewPromo] = useState({
    code: '',
    type_reduction: 'percent',
    valeur: '',
    utilisations_max: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profErr) throw profErr;
      if (!['super_admin', 'admin', 'staff'].includes(prof.role)) {
        throw new Error('Accès réservé aux administrateurs.');
      }
      setProfile(prof);

      const [tarifsData, promoData, bookingsData] = await Promise.all([
        pricingApi.getAllPlans(),
        pricingApi.getPromoCodes(),
        bookingApi.getAll(),
      ]);
      setTarifs(tarifsData.tarifs || []);
      setPromoCodes(promoData.promoCodes || []);
      setBookings(bookingsData.reservations || []);

      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setDate(to.getDate() + 7);
      const occ = await bookingApi.getOccupation({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setOccupation(occ.report || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleCreateTarif = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await pricingApi.createPlan({
        ...newTarif,
        prix: Number(newTarif.prix),
        tva_pct: Number(newTarif.tva_pct),
      });
      setNewTarif({ type_abonnement: 'mensuel', plan_tarifaire: 'standard', prix: '', tva_pct: '19' });
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleTarif = async (id, actif) => {
    try {
      await pricingApi.updatePlan(id, { actif: !actif });
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await pricingApi.createPromoCode({
        ...newPromo,
        valeur: Number(newPromo.valeur),
        utilisations_max: newPromo.utilisations_max ? Number(newPromo.utilisations_max) : null,
      });
      setNewPromo({ code: '', type_reduction: 'percent', valeur: '', utilisations_max: '' });
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleTogglePromo = async (id, actif) => {
    try {
      await pricingApi.updatePromoCode(id, { actif: !actif });
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleConfirmBooking = async (id) => {
    setActionId(id);
    setError('');
    try {
      await bookingApi.update(id, { statut: 'confirmed' });
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    setActionId(id);
    setError('');
    try {
      await bookingApi.cancel(id);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const BOOKING_STATUT_LABELS = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    cancelled: 'Annulée',
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
        <h1 className="font-sora text-headline-lg text-primary">Tarification & réservations</h1>
        <p className="text-on-surface-variant text-body-md mt-1">Module A + B — Semaine S2 Dev 1</p>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="flex gap-sm mb-md">
        {[
          { id: 'tarifs', label: 'Tarifs abonnements' },
          { id: 'promo', label: 'Codes promo' },
          { id: 'reservations', label: 'Réservations' },
          { id: 'occupation', label: 'Rapport occupation' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-md py-sm rounded-xl font-semibold text-label-sm ${
              tab === t.id ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tarifs' && (
        <div className="space-y-md">
          <form onSubmit={handleCreateTarif} className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10 grid sm:grid-cols-2 lg:grid-cols-5 gap-md items-end">
            <div>
              <label className="block text-label-sm mb-xs">Type</label>
              <select
                value={newTarif.type_abonnement}
                onChange={(e) => setNewTarif({ ...newTarif, type_abonnement: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              >
                {Object.entries(SUBSCRIPTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-sm mb-xs">Plan</label>
              <select
                value={newTarif.plan_tarifaire}
                onChange={(e) => setNewTarif({ ...newTarif, plan_tarifaire: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              >
                {Object.entries(PLAN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-sm mb-xs">Prix (DT)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={newTarif.prix}
                onChange={(e) => setNewTarif({ ...newTarif, prix: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              />
            </div>
            <div>
              <label className="block text-label-sm mb-xs">TVA %</label>
              <input
                type="number"
                min="0"
                value={newTarif.tva_pct}
                onChange={(e) => setNewTarif({ ...newTarif, tva_pct: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              />
            </div>
            <button type="submit" className="bg-secondary text-white py-xs px-md rounded-xl font-semibold">
              Ajouter
            </button>
          </form>

          <div className="bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="p-sm">Type</th>
                  <th className="p-sm">Plan</th>
                  <th className="p-sm">Prix</th>
                  <th className="p-sm">TVA</th>
                  <th className="p-sm">Statut</th>
                  <th className="p-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {tarifs.map((t) => (
                  <tr key={t.id} className="border-t border-outline-variant/10">
                    <td className="p-sm">{SUBSCRIPTION_LABELS[t.type_abonnement] || t.type_abonnement}</td>
                    <td className="p-sm">{PLAN_LABELS[t.plan_tarifaire] || t.plan_tarifaire}</td>
                    <td className="p-sm font-semibold">{Number(t.prix).toFixed(2)} DT</td>
                    <td className="p-sm">{t.tva_pct}%</td>
                    <td className="p-sm">
                      <span className={`px-2 py-0.5 rounded-full text-label-sm ${t.actif ? 'bg-secondary-fixed' : 'bg-surface-container-high'}`}>
                        {t.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-sm">
                      <button
                        type="button"
                        onClick={() => handleToggleTarif(t.id, t.actif)}
                        className="text-secondary font-semibold text-label-sm hover:underline"
                      >
                        {t.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'promo' && (
        <div className="space-y-md">
          <form onSubmit={handleCreatePromo} className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10 grid sm:grid-cols-2 lg:grid-cols-5 gap-md items-end">
            <div>
              <label className="block text-label-sm mb-xs">Code</label>
              <input
                required
                value={newPromo.code}
                onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                className="w-full border rounded-xl px-sm py-xs uppercase"
              />
            </div>
            <div>
              <label className="block text-label-sm mb-xs">Type</label>
              <select
                value={newPromo.type_reduction}
                onChange={(e) => setNewPromo({ ...newPromo, type_reduction: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              >
                <option value="percent">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
              </select>
            </div>
            <div>
              <label className="block text-label-sm mb-xs">Valeur</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={newPromo.valeur}
                onChange={(e) => setNewPromo({ ...newPromo, valeur: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
              />
            </div>
            <div>
              <label className="block text-label-sm mb-xs">Max utilisations</label>
              <input
                type="number"
                min="1"
                value={newPromo.utilisations_max}
                onChange={(e) => setNewPromo({ ...newPromo, utilisations_max: e.target.value })}
                className="w-full border rounded-xl px-sm py-xs"
                placeholder="Illimité"
              />
            </div>
            <button type="submit" className="bg-secondary text-white py-xs px-md rounded-xl font-semibold">
              Créer
            </button>
          </form>

          <div className="bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="p-sm">Code</th>
                  <th className="p-sm">Réduction</th>
                  <th className="p-sm">Utilisations</th>
                  <th className="p-sm">Statut</th>
                  <th className="p-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((p) => (
                  <tr key={p.id} className="border-t border-outline-variant/10">
                    <td className="p-sm font-mono font-semibold">{p.code}</td>
                    <td className="p-sm">
                      {p.type_reduction === 'percent' ? `${p.valeur}%` : `${p.valeur} DT`}
                    </td>
                    <td className="p-sm">
                      {p.utilisations_count}
                      {p.utilisations_max ? ` / ${p.utilisations_max}` : ''}
                    </td>
                    <td className="p-sm">
                      <span className={`px-2 py-0.5 rounded-full text-label-sm ${p.actif ? 'bg-secondary-fixed' : 'bg-surface-container-high'}`}>
                        {p.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-sm">
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(p.id, p.actif)}
                        className="text-secondary font-semibold text-label-sm hover:underline"
                      >
                        {p.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reservations' && (
        <div className="bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="p-sm">Membre</th>
                <th className="p-sm">Espace</th>
                <th className="p-sm">Créneau</th>
                <th className="p-sm">Statut</th>
                <th className="p-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-md text-on-surface-variant">Aucune réservation.</td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-t border-outline-variant/10">
                    <td className="p-sm">
                      {b.profiles?.prenom} {b.profiles?.nom}
                      <br />
                      <span className="text-on-surface-variant text-label-sm">{b.profiles?.email}</span>
                    </td>
                    <td className="p-sm font-semibold">{b.espaces?.nom}</td>
                    <td className="p-sm">
                      {new Date(b.date_debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      {' → '}
                      {new Date(b.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                    </td>
                    <td className="p-sm">
                      <span className={`px-2 py-0.5 rounded-full text-label-sm ${
                        b.statut === 'confirmed' ? 'bg-secondary-fixed' : 'bg-surface-container-high'
                      }`}>
                        {BOOKING_STATUT_LABELS[b.statut] || b.statut}
                      </span>
                    </td>
                    <td className="p-sm space-x-2">
                      {b.statut === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(b.id)}
                          disabled={actionId === b.id}
                          className="text-secondary font-semibold text-label-sm hover:underline disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                      )}
                      {['pending', 'confirmed'].includes(b.statut) && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={actionId === b.id}
                          className="text-error font-semibold text-label-sm hover:underline disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'occupation' && (
        <div className="bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="p-sm">Espace</th>
                <th className="p-sm">Type</th>
                <th className="p-sm">Capacité</th>
                <th className="p-sm">Réservations</th>
                <th className="p-sm">Taux occupation</th>
              </tr>
            </thead>
            <tbody>
              {occupation.map((row) => (
                <tr key={row.espace_id} className="border-t border-outline-variant/10">
                  <td className="p-sm font-semibold">{row.nom}</td>
                  <td className="p-sm">{row.type.replace('_', ' ')}</td>
                  <td className="p-sm">{row.capacite}</td>
                  <td className="p-sm">{row.reservations_count}</td>
                  <td className="p-sm">
                    <div className="flex items-center gap-sm">
                      <div className="flex-grow h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full"
                          style={{ width: `${Math.min(100, row.taux_occupation_pct)}%` }}
                        />
                      </div>
                      <span className="font-semibold w-12">{row.taux_occupation_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
