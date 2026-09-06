import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { guestApi } from '../services/api';

const SPACE_LABELS = {
  open_space: 'Open Space', private_office: 'Bureau privé',
  meeting_room: 'Salle de réunion', training_room: 'Salle de formation',
  event_space: 'Espace événementiel',
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop';

export default function GuestBookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantParam = searchParams.get('tenantId');
  const espaceParam = searchParams.get('espaceId');

  const [step, setStep]         = useState(1); // 1=espace 2=infos 3=confirmation
  const [coworking, setCoworking] = useState(null); // coworking sélectionné (image + coordonnées)
  const [coworkings, setCoworkings] = useState([]); // liste dispo quand pas de tenantId
  const [espaces, setEspaces]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState({ nom: '', prenom: '', email: '', telephone: '' });
  const [dates, setDates]       = useState({ debut: '', fin: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);

  useEffect(() => {
    (async () => {
      if (tenantParam) {
        try {
          const res = await guestApi.getCoworking(tenantParam);
          if (res.coworking) {
            setCoworking(res.coworking);
            const spaces = res.coworking.espaces || [];
            setEspaces(spaces);
            if (espaceParam) {
              const match = spaces.find(s => s.id === espaceParam);
              if (match) setSelected(match);
            }
          } else if (res.error) {
            setError(res.error);
          }
        } catch (e) { setError(e.message); }
      } else {
        try {
          const res = await guestApi.getCoworkings();
          setCoworkings(res.coworkings || []);
        } catch (e) { setError(e.message); }
      }
    })();
  }, [tenantParam, espaceParam]);

  const selectCoworking = async (t) => {
    setCoworking(t);
    setSelected(null);
    try {
      const res = await guestApi.getPublicEspaces(t.id);
      setEspaces(res.espaces || []);
    } catch (e) { setError(e.message); }
  };

  const resetCoworking = () => {
    setCoworking(null);
    setSelected(null);
    setEspaces([]);
  };

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
        tenant_id: coworking?.id || null,
      });
      if (res.error) { setError(res.error); return; }
      setResult(res);
      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const coworkingImg = (c) => c?.cover_url || c?.logo_url || FALLBACK_IMG;
  const coworkingPlace = (c) => [c?.adresse, c?.ville, c?.pays].filter(Boolean).join(', ');

  if (step === 3 && result) {
    const start = new Date(dates.debut);
    const end = new Date(dates.fin);

    return (
      <div className="min-h-screen bg-[#f4f5f7] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 bg-gradient-to-br from-[#f8fafc] to-[#eef2f7] px-6 py-8 text-center sm:px-8">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#dff7ef] bg-[#ebfaf4] text-[#18a873] shadow-inner">
                <span className="material-symbols-outlined" style={{ fontSize: 42 }}>check</span>
              </div>

              <h1 className="font-sora text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                Réservation confirmée
              </h1>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Un email de confirmation a été envoyé à{' '}
                <span className="font-semibold text-slate-800">{form.email}</span>.
              </p>
            </div>

            <div className="px-6 py-6 sm:px-8">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff2e9] text-[#f97316]">
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>location_on</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Coworking</p>
                    <p className="text-lg font-bold text-slate-900">{coworking?.nom || 'Coworking'}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Espace</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">{selected?.nom || 'Espace sélectionné'}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Date</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">
                      {start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Horaire</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">
                      {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="flex-1 rounded-2xl bg-[#ff6a2b] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,106,43,0.28)] transition hover:-translate-y-0.5 hover:bg-[#f55d1f]"
                >
                  Créer mon compte membre
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Retour à l'accueil
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Réservation rapide</p>
          <h1 className="mt-2 font-sora text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl">
            Réserver un espace
          </h1>
          <p className="mt-3 text-sm text-slate-600">Aucun compte requis — vous réservez en quelques clics.</p>
        </div>

        <div className="mb-8 flex items-center justify-center gap-3">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  step >= s ? 'bg-[#ff6a2b] text-white shadow-[0_8px_20px_rgba(255,106,43,0.25)]' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div className={`h-1 w-16 rounded-full ${step > s ? 'bg-[#ff6a2b]' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
              {error}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
              {!coworking && (
                <>
                  <h2 className="font-sora text-xl font-bold text-slate-900">Choisissez un coworking</h2>
                  <p className="mt-2 text-sm text-slate-600">Sélectionnez un espace pour démarrer votre réservation.</p>

                  {coworkings.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Aucun coworking disponible pour le moment.
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {coworkings.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selectCoworking(c)}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-[#ff6a2b]/40 hover:shadow-md"
                        >
                          <img src={coworkingImg(c)} alt={c.nom} loading="lazy" decoding="async" className="h-28 w-full object-cover" />
                          <div className="p-4">
                            <p className="font-bold text-slate-900">{c.nom}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                              {coworkingPlace(c) || c.pays || 'Tunisie'}
                            </p>
                            <p className="mt-2 text-[11px] font-medium text-slate-500">
                              {c.space_count ?? 0} espace(s) disponible(s)
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {coworking && (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-sora text-xl font-bold text-slate-900">{coworking.nom}</h2>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
                        {coworkingPlace(coworking) || 'Tunisie'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetCoworking}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Changer
                    </button>
                  </div>

                  <img src={coworkingImg(coworking)} alt={coworking.nom} loading="lazy" decoding="async" className="h-44 w-full rounded-2xl object-cover" />

                  <div>
                    <h3 className="font-sora text-lg font-bold text-slate-900">Choisissez votre espace</h3>
                    {espaces.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        Aucun espace disponible dans cet établissement.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {espaces.map((esp) => (
                          <button
                            key={esp.id}
                            onClick={() => setSelected(esp)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selected?.id === esp.id
                                ? 'border-[#ff6a2b] bg-[#fff4ef] ring-2 ring-[#ff6a2b]/15'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <p className="font-bold text-slate-900">{esp.nom}</p>
                            <p className="mt-1 text-xs text-slate-500">{SPACE_LABELS[esp.type] || esp.type}</p>
                            {esp.tarif_horaire && (
                              <p className="mt-2 text-sm font-bold text-[#ff6a2b]">{esp.tarif_horaire} DT/h</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selected && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Date & heure début
                        </label>
                        <input
                          type="datetime-local"
                          value={dates.debut}
                          onChange={(e) => setDates((d) => ({ ...d, debut: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#ff6a2b] focus:ring-2 focus:ring-[#ff6a2b]/10"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Date & heure fin
                        </label>
                        <input
                          type="datetime-local"
                          value={dates.fin}
                          onChange={(e) => setDates((d) => ({ ...d, fin: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#ff6a2b] focus:ring-2 focus:ring-[#ff6a2b]/10"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(2); }}
                    disabled={!coworking || !selected || !dates.debut || !dates.fin}
                    className="w-full rounded-2xl bg-[#ff6a2b] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_25px_rgba(255,106,43,0.28)] transition hover:bg-[#f55d1f] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuer
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
              <h3 className="font-sora text-lg font-bold text-slate-900">Résumé</h3>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff2e9] text-[#f97316]">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>hotel</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{coworking?.nom || 'Sélectionnez un coworking'}</p>
                    <p className="text-xs text-slate-500">{selected?.nom || 'Aucun espace sélectionné'}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium">Date</span>
                    <span className="text-right text-slate-800">
                      {dates.debut ? new Date(dates.debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium">Horaire</span>
                    <span className="text-right text-slate-800">
                      {dates.debut && dates.fin ? `${new Date(dates.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${new Date(dates.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Étape 2</p>
                <h2 className="font-sora text-2xl font-bold text-slate-900">Vos coordonnées</h2>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Modifier
              </button>
            </div>

            <div className="mb-6 rounded-2xl border border-[#ffefe8] bg-[#fffaf7] p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#ff6a2b]" style={{ fontSize: 22 }}>location_on</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{selected?.nom}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {coworking?.nom} · {new Date(dates.debut).toLocaleDateString('fr-FR')} · {new Date(dates.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(dates.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {[
                { key: 'prenom', label: 'Prénom *' },
                { key: 'nom', label: 'Nom *' },
                { key: 'email', label: 'Email *', type: 'email' },
                { key: 'telephone', label: 'Téléphone *', type: 'tel' },
              ].map(({ key, label, type = 'text' }) => (
                <div key={key} className={key === 'email' || key === 'telephone' ? 'sm:col-span-1' : 'sm:col-span-1'}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#ff6a2b] focus:ring-2 focus:ring-[#ff6a2b]/10"
                  />
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm text-slate-500">
              * La création de compte est optionnelle — vous recevrez votre confirmation par email.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-2xl bg-[#ff6a2b] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,106,43,0.28)] transition hover:bg-[#f55d1f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Confirmation...' : 'Confirmer la réservation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}