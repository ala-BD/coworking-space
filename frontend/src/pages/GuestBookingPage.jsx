import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestApi } from '../services/api';

const SPACE_LABELS = {
  open_space: 'Open Space', bureau_prive: 'Bureau privé',
  salle_reunion: 'Salle de réunion', salle_formation: 'Salle de formation',
  espace_evenementiel: 'Espace événementiel',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function GuestBookingPage() {
  const navigate = useNavigate();
  const [step, setStep]         = useState(1); // 1=espace 2=infos 3=confirmation
  const [espaces, setEspaces]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState({ nom: '', prenom: '', email: '', telephone: '' });
  const [dates, setDates]       = useState({ debut: '', fin: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/espaces`, { headers: { Authorization: 'Bearer public' } })
      .then(r => r.json()).then(d => setEspaces(d.espaces || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.nom || !form.prenom || !form.email || !form.telephone) {
      setError('Tous les champs sont obligatoires.'); return;
    }
    if (!dates.debut || !dates.fin) { setError('Veuillez choisir un créneau.'); return; }
    if (new Date(dates.debut) >= new Date(dates.fin)) {
      setError('La date de fin doit être après la date de début.'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await guestApi.booking({
        ...form, espace_id: selected.id,
        date_debut: dates.debut, date_fin: dates.fin,
      });
      if (res.error) { setError(res.error); return; }
      setResult(res);
      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (step === 3 && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-[#2fbe8f] block mb-3" style={{ fontSize: 56 }}>check_circle</span>
          <h1 className="font-sora font-bold text-primary text-2xl mb-2">Réservation confirmée !</h1>
          <p className="text-on-surface-variant text-sm mb-4">
            Un email de confirmation a été envoyé à <strong>{form.email}</strong>.
          </p>
          <div className="bg-surface-container-low rounded-2xl p-4 text-left text-sm mb-6 space-y-1.5">
            <p><span className="font-semibold">Espace :</span> {selected?.nom}</p>
            <p><span className="font-semibold">Date :</span> {new Date(dates.debut).toLocaleDateString('fr-FR')}</p>
            <p><span className="font-semibold">Horaire :</span> {new Date(dates.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(dates.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate('/register')}
              className="w-full py-2.5 bg-secondary text-white rounded-xl font-semibold text-sm hover:bg-secondary/90">
              Créer mon compte membre
            </button>
            <button onClick={() => navigate('/')}
              className="w-full py-2.5 border border-outline-variant/30 text-on-surface-variant rounded-xl font-semibold text-sm hover:bg-surface-container">
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-sora font-bold text-primary text-3xl mb-2">Réserver un espace</h1>
          <p className="text-on-surface-variant text-sm">Aucun compte requis — remplissez juste vos coordonnées.</p>
          {/* Steps */}
          <div className="flex items-center justify-center gap-3 mt-6">
            {[1, 2].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                  step >= s ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
                }`}>{s}</div>
                {s < 2 && <div className={`h-0.5 w-16 ${step > s ? 'bg-secondary' : 'bg-surface-container-high'}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-center gap-16 mt-1 text-[11px] text-on-surface-variant font-semibold">
            <span>Espace & horaires</span>
            <span>Vos coordonnées</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
            {error}
          </div>
        )}

        {/* Étape 1 — Choix espace + créneau */}
        {step === 1 && (
          <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 shadow-sm">
            <h2 className="font-sora font-bold text-primary text-base mb-4">Choisissez votre espace</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {espaces.map((esp) => (
                <button key={esp.id} onClick={() => setSelected(esp)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    selected?.id === esp.id
                      ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20'
                      : 'border-outline-variant/20 hover:border-secondary/30'
                  }`}>
                  <p className="font-semibold text-primary text-sm">{esp.nom}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{SPACE_LABELS[esp.type] || esp.type}</p>
                  {esp.tarif_horaire && (
                    <p className="text-xs font-bold text-secondary mt-1">{esp.tarif_horaire} DT/h</p>
                  )}
                </button>
              ))}
            </div>

            {selected && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Date & heure début *
                  </label>
                  <input type="datetime-local" value={dates.debut}
                    onChange={e => setDates(d => ({ ...d, debut: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/15 outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Date & heure fin *
                  </label>
                  <input type="datetime-local" value={dates.fin}
                    onChange={e => setDates(d => ({ ...d, fin: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/15 outline-none" />
                </div>
              </div>
            )}

            <button onClick={() => { setError(''); setStep(2); }}
              disabled={!selected || !dates.debut || !dates.fin}
              className="w-full py-3 bg-secondary text-white rounded-2xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-40 transition-all">
              Continuer →
            </button>
          </div>
        )}

        {/* Étape 2 — Coordonnées */}
        {step === 2 && (
          <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 shadow-sm">
            <h2 className="font-sora font-bold text-primary text-base mb-4">Vos coordonnées</h2>

            {/* Récap espace */}
            <div className="bg-secondary/5 border border-secondary/15 rounded-2xl p-3 mb-5 flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>location_on</span>
              <div>
                <p className="font-semibold text-primary text-sm">{selected?.nom}</p>
                <p className="text-xs text-on-surface-variant">
                  {new Date(dates.debut).toLocaleDateString('fr-FR')} · {new Date(dates.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(dates.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setStep(1)} className="ml-auto text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {[
                { key: 'prenom', label: 'Prénom *' },
                { key: 'nom', label: 'Nom *' },
                { key: 'email', label: 'Email *', type: 'email' },
                { key: 'telephone', label: 'Téléphone *', type: 'tel' },
              ].map(({ key, label, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    {label}
                  </label>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/15 outline-none" />
                </div>
              ))}
            </div>

            <p className="text-[11px] text-on-surface-variant mb-4">
              * La création de compte est optionnelle — vous recevrez votre confirmation par email.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="px-5 py-2.5 border border-outline-variant/30 text-on-surface-variant rounded-xl font-semibold text-sm hover:bg-surface-container">
                ← Retour
              </button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-2.5 bg-secondary text-white rounded-2xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />Confirmation…</> : 'Confirmer la réservation'}
              </button>
            </div>
          </div>
        )}

        {/* Lien connexion */}
        <p className="text-center text-sm text-on-surface-variant mt-6">
          Vous avez déjà un compte ?{' '}
          <button onClick={() => navigate('/login')} className="text-secondary font-semibold hover:underline">
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
}
