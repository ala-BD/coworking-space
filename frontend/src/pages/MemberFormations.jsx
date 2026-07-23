import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { formationApi, paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const STATUT_INSCRIPTION_LABELS = {
  confirmee: 'Confirmée',
  en_attente: 'En attente',
  annulee: 'Annulée',
};

export default function MemberFormations({ session }) {
  const [profile, setProfile] = useState(null);
  const [formations, setFormations] = useState([]);
  const [myInscriptions, setMyInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFormation, setSelectedFormation] = useState(null);
  const [saving, setSaving] = useState(null); // formation id being acted on
  const navigate = useNavigate();

  useEffect(() => { loadUserData(); }, []);

  /* ─── Auto-dismiss success ─── */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(t);
  }, [success]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: prof, error: e } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (e) throw e;
      setProfile(prof);
      await refreshData();
    } catch (e) { setError(e.message); setLoading(false); }
  };

  const refreshData = async () => {
    try {
      const [fList, myList] = await Promise.all([
        formationApi.getAll({ statut: 'planifiee' }),
        formationApi.getMesFormations(),
      ]);
      setFormations(fList.formations || []);
      setMyInscriptions(myList.inscriptions || []);
    } catch (e) { setError('Erreur chargement : ' + e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async (formationId) => {
    setError(''); setSaving(formationId);
    try {
      const res = await formationApi.inscrire(formationId);
      const f = formations.find(x => x.id === formationId);
      if (res.liste_attente) setSuccess("Formation complète — ajouté à la liste d'attente !");
      else if (f?.prix_inscription > 0) setSuccess('Inscription confirmée ! Veuillez régler le paiement pour finaliser.');
      else setSuccess('Inscription confirmée avec succès !');
      await refreshData();
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  };

  const handleUnregister = async (formationId) => {
    if (!window.confirm('Annuler votre inscription à cette formation ?')) return;
    setError(''); setSaving(formationId);
    try {
      await formationApi.desinscrire(formationId);
      setSuccess('Inscription annulée.');
      await refreshData();
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  };

  const handlePayFormation = async (formationId, paiementId) => {
    setError(''); setSaving(formationId);
    try {
      let paymentId = paiementId;
      if (!paymentId) {
        const res = await formationApi.createFormationPayment(formationId);
        paymentId = res.payment?.id;
      }
      if (!paymentId) {
        throw new Error('Aucun paiement trouvé pour cette formation.');
      }

      const res = await paymentApi.payWithStripe(paymentId);
      if (res.link) {
        window.location.href = res.link;
        return;
      }
      throw new Error('Lien de paiement non reçu.');
    } catch (err) {
      setError(err.message || 'Impossible de lancer le paiement.');
    } finally {
      setSaving(null);
    }
  };

  const isInscribed = (formationId) =>
    myInscriptions.some(m => m.formation_id === formationId && m.statut !== 'annulee');

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );

  const activeInscriptions = myInscriptions.filter(m => m.statut !== 'annulee');

  return (
    <PortalLayout profile={profile} onLogout={() => supabase.auth.signOut()}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>school</span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Espace Formation</span>
          </div>
          <h1 className="font-sora font-bold text-primary text-2xl sm:text-3xl">Formations & Ateliers</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Inscrivez-vous à nos workshops et sessions de formation professionnelle.
          </p>
        </div>

        {/* ── Alertes ── */}
        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-sm">
            <span className="material-symbols-outlined text-red-500 shrink-0" style={{ fontSize: 18 }}>error</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">
            <span className="material-symbols-outlined text-emerald-500 shrink-0" style={{ fontSize: 18 }}>check_circle</span>
            <div className="flex-1">
              <span>{success}</span>
              {success.includes('paiement') && (
                <button onClick={() => navigate('/member/payments')} className="ml-3 underline font-semibold text-emerald-900 text-xs">
                  Voir mes factures →
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ══ CATALOGUE ══ */}
          <div className="lg:col-span-2">
            <h2 className="font-sora font-semibold text-primary text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>explore</span>
              Workshops disponibles
              <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full ml-1">
                {formations.length}
              </span>
            </h2>

            {formations.length === 0 ? (
              <div className="bg-white rounded-3xl border border-outline-variant/20 p-10 text-center shadow-sm">
                <span className="material-symbols-outlined text-on-surface-variant/30 block mb-3" style={{ fontSize: 48 }}>calendar_today</span>
                <p className="font-semibold text-primary mb-1">Aucune session planifiée</p>
                <p className="text-sm text-on-surface-variant">Revenez bientôt pour découvrir nos prochains ateliers !</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formations.map((f) => {
                  const enrolled = isInscribed(f.id);
                  const isSaving = saving === f.id;
                  const isFull = (f.places_restantes ?? (f.capacite_max - (f.nb_inscrits || 0))) <= 0;

                  return (
                    <div
                      key={f.id}
                      className={`bg-white rounded-3xl border flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                        enrolled ? 'border-secondary/30 bg-secondary/[0.01]' : 'border-outline-variant/20'
                      }`}
                    >
                      {/* Top color bar */}
                      <div className={`h-1 rounded-t-3xl ${enrolled ? 'bg-secondary' : isFull ? 'bg-amber-400' : 'bg-outline-variant/20'}`} />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Badges */}
                        <div className="flex justify-between items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/8 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                            {f.espaces?.nom || 'Atelier'}
                          </span>
                          <span className={`text-xs font-bold shrink-0 ${f.prix_inscription > 0 ? 'text-primary' : 'text-emerald-600'}`}>
                            {f.prix_inscription > 0 ? `${f.prix_inscription.toFixed(2)} DT` : 'Gratuit'}
                          </span>
                        </div>

                        <h3 className="font-sora font-bold text-primary text-base leading-snug mb-1.5">{f.titre}</h3>
                        <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{f.description || 'Aucune description.'}</p>

                        {/* Info lines */}
                        <div className="space-y-1.5 text-[11px] text-on-surface-variant mb-4 mt-auto">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person</span>
                            <span>{f.profiles ? `${f.profiles.prenom} ${f.profiles.nom}` : 'Formateur'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_today</span>
                            <span>
                              {new Date(f.date_debut).toLocaleDateString('fr-FR')} · {new Date(f.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {new Date(f.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>group</span>
                            <span>
                              <strong className={isFull ? 'text-amber-600' : 'text-primary'}>
                                {f.places_restantes ?? (f.capacite_max - (f.nb_inscrits || 0))}
                              </strong>
                              &nbsp;place{(f.places_restantes ?? 0) > 1 ? 's' : ''} disponible{(f.places_restantes ?? 0) > 1 ? 's' : ''}
                              <span className="text-on-surface-variant"> / {f.capacite_max}</span>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-outline-variant/10">
                          <button
                            onClick={() => setSelectedFormation(f)}
                            className="flex-1 py-2 border border-outline-variant/30 text-on-surface-variant font-semibold rounded-xl text-xs hover:bg-surface-container transition-colors"
                          >
                            Programme
                          </button>
                          {enrolled ? (
                            <button
                              disabled
                              className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-xl text-xs border border-emerald-200 flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                              Inscrit
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRegister(f.id)}
                              disabled={isSaving || isFull}
                              className="flex-1 py-2 bg-secondary text-white font-semibold rounded-xl text-xs hover:bg-secondary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                              {isSaving
                                ? <span className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                                : isFull ? 'Complet' : "S'inscrire"
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ══ MES INSCRIPTIONS ══ */}
          <div>
            <h2 className="font-sora font-semibold text-primary text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>assignment_turned_in</span>
              Mes inscriptions
              {activeInscriptions.length > 0 && (
                <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full ml-1">
                  {activeInscriptions.length}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {activeInscriptions.length === 0 ? (
                <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 text-center shadow-sm">
                  <span className="material-symbols-outlined text-on-surface-variant/30 block mb-2" style={{ fontSize: 36 }}>event_busy</span>
                  <p className="text-sm text-on-surface-variant">Aucune inscription.</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">Choisissez un atelier dans le catalogue.</p>
                </div>
              ) : (
                activeInscriptions.map((my) => {
                  const item = my.formations;
                  if (!item) return null;
                  const isSaving = saving === item.id;
                  return (
                    <div key={my.id} className="bg-white rounded-2xl border border-outline-variant/20 p-4 shadow-sm hover:border-secondary/20 transition-colors">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="font-semibold text-primary text-sm leading-snug line-clamp-2 flex-1">{item.titre}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          my.statut === 'confirmee' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {STATUT_INSCRIPTION_LABELS[my.statut] || my.statut}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-on-surface-variant mb-3">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>person</span>
                          {item.profiles ? `${item.profiles.prenom} ${item.profiles.nom}` : 'Formateur'}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>calendar_today</span>
                          {new Date(item.date_debut).toLocaleDateString('fr-FR')} à {new Date(item.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Paiement badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-semibold text-on-surface-variant">Paiement :</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                          my.statut_paiement === 'paye' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          my.statut_paiement === 'gratuit' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {my.statut_paiement === 'paye' ? 'Payé ✓' : my.statut_paiement === 'gratuit' ? 'Gratuit' : 'À régler'}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-outline-variant/10">
                        {my.statut_paiement === 'en_attente' && (
                          <button
                            onClick={() => handlePayFormation(item.id, my.paiement_id)}
                            disabled={saving === item.id}
                            className="flex-1 py-1.5 bg-amber-500 text-white font-semibold rounded-lg text-[10px] hover:bg-amber-600 disabled:opacity-60"
                          >
                            {saving === item.id ? 'Chargement...' : 'Régler →'}
                          </button>
                        )}
                        <button
                          onClick={() => handleUnregister(item.id)}
                          disabled={isSaving}
                          className="flex-1 py-1.5 border border-error/30 text-error font-semibold rounded-lg text-[10px] hover:bg-error/5 disabled:opacity-50"
                        >
                          {isSaving ? '...' : 'Annuler'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Programme ── */}
      {selectedFormation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setSelectedFormation(null)} />
          <div className="relative w-full max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-outline-variant/10">
            <div className="p-5 sm:p-6 border-b border-outline-variant/20 flex justify-between items-start gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary bg-secondary/10 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>view_carousel</span>
                  Programme
                </span>
                <h2 className="font-sora font-bold text-xl sm:text-2xl text-primary mt-4 leading-tight line-clamp-2">
                  {selectedFormation.titre}
                </h2>
              </div>
              <button
                onClick={() => setSelectedFormation(null)}
                className="h-10 w-10 rounded-2xl border border-outline-variant/20 bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-hover transition"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-6">
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Description</p>
                    <p className="text-sm leading-6 text-primary">{selectedFormation.description || 'Aucune description fournie pour ce workshop.'}</p>
                  </div>

                  {selectedFormation.programme && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Déroulement</p>
                      <div className="space-y-3 text-sm leading-6 text-primary">
                        {selectedFormation.programme.split('\n').map((line, index) => (
                          <p key={index} className="break-words">{line || '\u00A0'}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/10 p-4 sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">Détails</p>
                    <ul className="space-y-3 text-sm text-primary">
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>person</span>
                        <span>{selectedFormation.profiles ? `${selectedFormation.profiles.prenom} ${selectedFormation.profiles.nom}` : 'Formateur'}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>calendar_today</span>
                        <span>{new Date(selectedFormation.date_debut).toLocaleDateString('fr-FR')} · {new Date(selectedFormation.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {new Date(selectedFormation.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>people</span>
                        <span>{selectedFormation.places_restantes ?? (selectedFormation.capacite_max - (selectedFormation.nb_inscrits || 0))} / {selectedFormation.capacite_max} places disponibles</span>
                      </li>
                      {selectedFormation.prerequis && (
                        <li className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>checklist_rtl</span>
                          <span>{selectedFormation.prerequis}</span>
                        </li>
                      )}
                      {selectedFormation.materiel && (
                        <li className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>inventory_2</span>
                          <span>{selectedFormation.materiel}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-t border-outline-variant/20 bg-surface-container">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setSelectedFormation(null)}
                  className="flex-1 py-3 border border-outline-variant/30 text-on-surface-variant font-semibold rounded-2xl text-sm hover:bg-surface-hover transition"
                >
                  Fermer
                </button>
                {!isInscribed(selectedFormation.id) && (
                  <button
                    onClick={() => { handleRegister(selectedFormation.id); setSelectedFormation(null); }}
                    className="flex-1 py-3 bg-secondary text-white font-semibold rounded-2xl text-sm hover:bg-secondary/90 transition"
                  >
                    S'inscrire
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
