import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { memberApi, subscriptionApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const SUBSCRIPTION_LABELS = {
  day_pass: 'Day Pass',
  week_pass: 'Week Pass',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  bureau_prive: 'Bureau privé',
};

const MEMBER_TYPE_LABELS = {
  individuel: 'Individuel',
  entreprise: 'Entreprise',
  etudiant: 'Étudiant',
};

const ROLE_LABELS = {
  member: 'Membre',
  admin: 'Administrateur',
  staff: 'Staff',
  formateur: 'Formateur',
  super_admin: 'Super Admin',
  guest: 'Invité',
};

const STATUT_LABELS = {
  active: 'Actif',
  suspended: 'Suspendu',
  expired: 'Expiré',
};

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-xl p-md custom-shadow border border-outline-variant/10">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-sora text-headline-sm text-primary capitalize">{value || '—'}</p>
    </div>
  );
}

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', cin: '', type_membre: 'individuel' });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [{ profile: prof }, { subscription }, { subscriptions }] = await Promise.all([
        memberApi.getMe(),
        subscriptionApi.getActive(),
        subscriptionApi.getMine(),
      ]);
      setProfile(prof);
      setActiveSubscription(subscription);
      setSubscriptionHistory(subscriptions || []);
      setForm({
        nom: prof.nom || '',
        prenom: prof.prenom || '',
        telephone: prof.telephone || '',
        cin: prof.cin || '',
        type_membre: prof.type_membre || 'individuel',
      });
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { profile: updated } = await memberApi.updateMe(form);
      setProfile(updated);
      setEditing(false);
      setSuccess('Profil mis à jour avec succès.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
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
        <h1 className="font-sora text-headline-lg text-primary">
          {greeting()}, {profile?.prenom || 'Membre'}.
        </h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Portail membre — Module A (profil & abonnements) · Semaine S1
        </p>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-md p-sm bg-secondary-fixed text-on-secondary-fixed text-body-sm rounded-xl flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8 space-y-md">
          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
            <div className="flex items-center justify-between mb-md">
              <h2 className="font-sora text-headline-sm text-primary">Mon profil</h2>
              <div className="flex items-center gap-sm">
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold uppercase">
                  {profile?.statut_compte || 'actif'}
                </span>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-secondary font-semibold text-label-sm hover:underline"
                  >
                    Modifier
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-md">
                <div className="grid sm:grid-cols-2 gap-md">
                  <div>
                    <label className="block text-label-sm text-primary mb-xs" htmlFor="prenom">Prénom</label>
                    <input
                      id="prenom"
                      value={form.prenom}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                      className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-primary mb-xs" htmlFor="nom">Nom</label>
                    <input
                      id="nom"
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-primary mb-xs" htmlFor="telephone">Téléphone</label>
                    <input
                      id="telephone"
                      value={form.telephone}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                      className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-primary mb-xs" htmlFor="cin">CIN / Passeport</label>
                    <input
                      id="cin"
                      value={form.cin}
                      onChange={(e) => setForm({ ...form, cin: e.target.value })}
                      className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-label-sm text-primary mb-xs" htmlFor="type_membre">Type membre</label>
                    <select
                      id="type_membre"
                      value={form.type_membre}
                      onChange={(e) => setForm({ ...form, type_membre: e.target.value })}
                      className="w-full border border-outline-variant/30 rounded-xl px-sm py-xs"
                    >
                      <option value="individuel">Individuel</option>
                      <option value="entreprise">Entreprise</option>
                      <option value="etudiant">Étudiant</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-sm">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-secondary text-white px-md py-sm rounded-xl font-semibold disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="border border-outline-variant/30 px-md py-sm rounded-xl font-semibold"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid sm:grid-cols-2 gap-md">
                <StatCard label="Nom complet" value={`${profile?.prenom || ''} ${profile?.nom || ''}`.trim()} icon="person" />
                <StatCard label="Email" value={profile?.email || session.user.email} icon="mail" />
                <StatCard label="Téléphone" value={profile?.telephone} icon="call" />
                <StatCard label="Type membre" value={MEMBER_TYPE_LABELS[profile?.type_membre] || profile?.type_membre} icon="badge" />
                <StatCard label="Rôle" value={ROLE_LABELS[profile?.role] || profile?.role} icon="shield_person" />
                <StatCard label="CIN / Passeport" value={profile?.cin || 'Non renseigné'} icon="id_card" />
              </div>
            )}
          </div>

          {/* Historique abonnements — CDC A1 */}
          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
            <h2 className="font-sora text-headline-sm text-primary mb-md">Historique des abonnements</h2>
            {subscriptionHistory.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Aucun abonnement enregistré.</p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {subscriptionHistory.map((sub) => (
                  <div key={sub.id} className="py-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                    <div>
                      <p className="font-semibold text-primary">
                        {SUBSCRIPTION_LABELS[sub.type] || sub.type}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {new Date(sub.date_debut).toLocaleDateString('fr-FR')}
                        {' → '}
                        {new Date(sub.date_fin).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={`self-start px-sm py-xs rounded-full text-label-sm font-semibold uppercase ${
                      sub.statut === 'active' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {STATUT_LABELS[sub.statut] || sub.statut}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant/20">
            <div className="flex gap-sm items-start">
              <span className="material-symbols-outlined text-secondary">info</span>
              <p className="text-body-sm text-on-surface-variant">
                Réservations et minuteur live : semaine S2. Factures et paiements : Dev 2 (Module C).
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-primary text-white rounded-xl p-lg custom-shadow h-full relative overflow-hidden flex flex-col justify-between min-h-[280px]">
            <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-md">
                <div className="bg-secondary px-3 py-1 rounded-full">
                  <span className="text-label-sm uppercase tracking-widest text-white font-semibold">
                    {activeSubscription ? 'Abonnement actif' : 'Sans abonnement'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-outline-variant">workspace_premium</span>
              </div>

              {activeSubscription ? (
                <>
                  <h3 className="font-sora text-headline-sm mb-xs">
                    {SUBSCRIPTION_LABELS[activeSubscription.type] || activeSubscription.type}
                  </h3>
                  <p className="text-on-primary-container text-body-sm">
                    Du {new Date(activeSubscription.date_debut).toLocaleDateString('fr-FR')}
                    {' '}au {new Date(activeSubscription.date_fin).toLocaleDateString('fr-FR')}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-sora text-headline-sm mb-xs">Aucun abonnement actif</h3>
                  <p className="text-on-primary-container text-body-sm">
                    Un admin/staff peut créer un abonnement via l&apos;API{' '}
                    <code className="text-xs bg-white/10 px-1 rounded">POST /api/subscriptions</code>.
                  </p>
                </>
              )}
            </div>

            {activeSubscription && (
              <div className="relative z-10 space-y-sm mt-lg">
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-primary-container">Renouvellement auto</span>
                  <span className="font-semibold">{activeSubscription.renouvellement_auto ? 'Oui' : 'Non'}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-primary-container">Statut</span>
                  <span className="font-semibold capitalize">{STATUT_LABELS[activeSubscription.statut] || activeSubscription.statut}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
