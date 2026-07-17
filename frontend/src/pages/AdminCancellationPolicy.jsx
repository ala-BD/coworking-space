import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { settingsApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

export default function AdminCancellationPolicy({ session }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    delai_heures: 24,
    penalite_pct: 0,
    annulation_membre_autorisee: true,
    remboursement_auto: false,
    message_membre: '',
  });
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(prof);

      const { policy } = await settingsApi.getCancellationPolicy();
      setForm({
        delai_heures: policy.delai_heures ?? 24,
        penalite_pct: policy.penalite_pct ?? 0,
        annulation_membre_autorisee: policy.annulation_membre_autorisee ?? true,
        remboursement_auto: policy.remboursement_auto ?? false,
        message_membre: policy.message_membre ?? '',
      });
      setUpdatedAt(policy.updated_at);
    } catch {
      setMsg({ type: 'error', text: 'Erreur de chargement.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { policy: updated } = await settingsApi.updateCancellationPolicy(form);
      setUpdatedAt(updated.updated_at);
      setMsg({ type: 'success', text: 'Politique d\'annulation mise à jour.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Erreur de sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
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
      <div className="space-y-lg">
        <div>
          <h1 className="font-sora text-headline-lg text-primary">
            Politique d'annulation
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Configurez les règles d'annulation et de remboursement pour les réservations.
          </p>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-label-md font-medium ${
            msg.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.text}
          </div>
        )}

        <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10 space-y-lg">
          <h2 className="font-sora text-headline-sm text-primary">
            Règles d'annulation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="space-y-2">
              <label className="text-label-md font-semibold text-on-surface" htmlFor="delai_heures">
                Délai d'annulation gratuit (heures)
              </label>
              <input
                id="delai_heures"
                name="delai_heures"
                type="number"
                min="0"
                max="168"
                value={form.delai_heures}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <p className="text-body-sm text-on-surface-variant">
                Le membre peut annuler gratuitement jusqu'à {form.delai_heures}h avant le début.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-label-md font-semibold text-on-surface" htmlFor="penalite_pct">
                Pénalité (% du montant)
              </label>
              <input
                id="penalite_pct"
                name="penalite_pct"
                type="number"
                min="0"
                max="100"
                step="5"
                value={form.penalite_pct}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <p className="text-body-sm text-on-surface-variant">
                Pourcentage retenu en cas d'annulation tardive.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                name="annulation_membre_autorisee"
                type="checkbox"
                checked={form.annulation_membre_autorisee}
                onChange={handleChange}
                className="h-5 w-5 rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              <div>
                <span className="text-label-md font-semibold text-on-surface">
                  Autoriser les annulations en ligne
                </span>
                <p className="text-body-sm text-on-surface-variant">
                  Si désactivé, les membres devront contacter l'accueil pour annuler.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                name="remboursement_auto"
                type="checkbox"
                checked={form.remboursement_auto}
                onChange={handleChange}
                className="h-5 w-5 rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              <div>
                <span className="text-label-md font-semibold text-on-surface">
                  Remboursement automatique
                </span>
                <p className="text-body-sm text-on-surface-variant">
                  Rembourser automatiquement en cas d'annulation conforme.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-label-md font-semibold text-on-surface" htmlFor="message_membre">
              Message affiché aux membres
            </label>
            <textarea
              id="message_membre"
              name="message_membre"
              rows={3}
              value={form.message_membre}
              onChange={handleChange}
              placeholder="Ex: Annulation gratuite jusqu'à 24h avant le début du créneau."
              className="w-full px-4 py-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
          <h2 className="font-sora text-headline-sm text-primary mb-4">
            Aperçu du comportement
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <span className="material-symbols-outlined text-green-600 mt-0.5">check_circle</span>
              <div>
                <p className="text-label-md font-medium text-green-800">
                  Annulation &ge; {form.delai_heures}h avant
                </p>
                <p className="text-body-sm text-green-700">
                  Autorisée. {form.penalite_pct === 0 ? 'Sans pénalité.' : `Pénalité de ${form.penalite_pct}%.`}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <span className="material-symbols-outlined text-red-600 mt-0.5">cancel</span>
              <div>
                <p className="text-label-md font-medium text-red-800">
                  Annulation &lt; {form.delai_heures}h avant
                </p>
                <p className="text-body-sm text-red-700">
                  {!form.annulation_membre_autorisee
                    ? 'Non autorisée. Le membre doit contacter l\'accueil.'
                    : 'Refusée en ligne.'}
                </p>
              </div>
            </div>
            {form.remboursement_auto && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <span className="material-symbols-outlined text-blue-600 mt-0.5">autorenew</span>
                <div>
                  <p className="text-label-md font-medium text-blue-800">Remboursement automatique</p>
                  <p className="text-body-sm text-blue-700">
                    Activé — les annulations conformes déclenchent un remboursement.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          {updatedAt && (
            <p className="text-body-sm text-on-surface-variant">
              Dernière mise à jour : {new Date(updatedAt).toLocaleString('fr-FR')}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </PortalLayout>
  );
}
