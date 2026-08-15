import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { formationApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const STATUT_STYLES = {
  planifiee: 'bg-amber-50 text-amber-800 border border-amber-200',
  en_cours: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  terminee: 'bg-sky-50 text-sky-800 border border-sky-200',
  annulee: 'bg-red-50 text-red-800 border border-red-200',
};
const STATUT_LABELS = {
  planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
};

const INSCRIT_STATUT_STYLES = {
  confirmee:  'bg-emerald-100 text-emerald-800',
  en_attente: 'bg-amber-100  text-amber-800',
  annulee:    'bg-red-100    text-red-800',
};
const INSCRIT_STATUT_LABELS = {
  confirmee: 'Confirmée', en_attente: 'En attente', annulee: 'Annulée',
};
const PAIEMENT_STYLES = {
  gratuit:    'bg-slate-100  text-slate-700',
  paye:       'bg-emerald-100 text-emerald-800',
  en_attente: 'bg-amber-100  text-amber-800',
  rembourse:  'bg-sky-100    text-sky-800',
};
const PAIEMENT_LABELS = {
  gratuit: 'Gratuit', paye: 'Payé', en_attente: 'En attente', rembourse: 'Remboursé',
};

export default function TrainerDashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [formations, setFormations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [espaces, setEspaces] = useState([]);
  const [inscriptions, setInscriptions] = useState({});   // Map formation_id → participants[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* Modals */
  const [showCreateFormation, setShowCreateFormation] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedFormationParticipants, setSelectedFormationParticipants] = useState(null); // formation object

  /* Forms */
  const [formationForm, setFormationForm] = useState({
    titre: '', description: '', espace_id: '', capacite_max: 10,
    prix_inscription: 0, date_debut: '', date_fin: '', programme: '', prerequis: '', materiel: ''
  });
  const [bookingForm, setBookingForm] = useState({
    espace_id: '', date_debut: '', date_fin: ''
  });
  const [selectedEspace, setSelectedEspace] = useState(null);

  useEffect(() => { loadUserData(); }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: prof, error: e } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (e) throw e;
      if (prof.role !== 'formateur') throw new Error('Accès réservé aux formateurs.');
      setProfile(prof);
      await refreshData(prof.id);
    } catch (e) { setError(e.message); setLoading(false); }
  };

  const refreshData = async (trainerId) => {
    try {
      const id = trainerId || profile?.id;
      const [fList, rList, eList] = await Promise.all([
        formationApi.getAll({ formateur_id: id }),
        supabase.from('reservations')
          .select('*, espaces(*)')
          .eq('user_id', id)
          .order('date_debut', { ascending: true }),
        supabase.from('espaces').select('*').order('nom'),
      ]);
      const fData = fList.formations || [];
      setFormations(fData);
      setReservations(rList.data || []);
      setEspaces(eList.data || []);

      // Charger les inscriptions pour toutes les formations du formateur
      if (fData.length > 0) {
        const formationIds = fData.map(f => f.id);
        const { data: inscrData } = await supabase
          .from('inscriptions_formations')
          .select('*, profiles!user_id(id, nom, prenom, email, telephone)')
          .in('formation_id', formationIds)
          .order('created_at', { ascending: true });
        // Grouper par formation_id
        const grouped = {};
        (inscrData || []).forEach(i => {
          if (!grouped[i.formation_id]) grouped[i.formation_id] = [];
          grouped[i.formation_id].push(i);
        });
        setInscriptions(grouped);
      } else {
        setInscriptions({});
      }
    } catch (e) { setError('Erreur chargement : ' + e.message); }
    finally { setLoading(false); }
  };

  const handleCreateFormation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await formationApi.create({
        ...formationForm,
        formateur_id: profile.id,
        statut: 'planifiee',
      });
      setSuccess('Formation créée avec succès !');
      setFormationForm({
        titre: '', description: '', espace_id: '', capacite_max: 10,
        prix_inscription: 0, date_debut: '', date_fin: '', programme: '', prerequis: '', materiel: ''
      });
      setShowCreateFormation(false);
      await refreshData();
    } catch (err) { setError(err.message); }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase.from('reservations').insert({
        user_id: profile.id,
        espace_id: bookingForm.espace_id,
        date_debut: new Date(bookingForm.date_debut).toISOString(),
        date_fin: new Date(bookingForm.date_fin).toISOString(),
        statut: 'pending',
        mode: 'online',
      });
      if (error) throw error;
      setSuccess('Réservation créée avec succès !');
      setBookingForm({ espace_id: '', date_debut: '', date_fin: '' });
      setSelectedEspace(null);
      setShowBookingModal(false);
      await refreshData();
    } catch (err) { setError(err.message); }
  };

  const calculateEstimatedPrice = () => {
    if (!selectedEspace || !bookingForm.date_debut || !bookingForm.date_fin) return 0;
    const start = new Date(bookingForm.date_debut);
    const end = new Date(bookingForm.date_fin);
    const hours = (end - start) / (1000 * 60 * 60);
    return hours > 0 ? (hours * selectedEspace.tarif_horaire).toFixed(2) : 0;
  };

  /* KPIs */
  const totalFormations = formations.length;
  const upcomingFormations = formations.filter(f => f.statut === 'planifiee').length;
  const totalReservations = reservations.length;
  const activeReservations = reservations.filter(r => r.statut === 'confirmed').length;
  const totalInscrits = Object.values(inscriptions).reduce((sum, arr) => sum + arr.filter(i => i.statut !== 'annulee').length, 0);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );

  return (
    <PortalLayout profile={profile} onLogout={() => supabase.auth.signOut()}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>school</span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Espace Formateur</span>
          </div>
          <h1 className="font-sora font-bold text-primary text-2xl sm:text-3xl">Mon Dashboard</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Bonjour {profile?.prenom} — Gérez vos formations et vos réservations d'espaces.
          </p>
        </div>

        {/* Alertes */}
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
            <span>{success}</span>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Mes formations', value: totalFormations, icon: 'event_note', color: 'text-secondary bg-secondary/10' },
            { label: 'À venir', value: upcomingFormations, icon: 'upcoming', color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Total inscrits', value: totalInscrits, icon: 'group', color: 'text-violet-600 bg-violet-50' },
            { label: 'Réservations actives', value: activeReservations, icon: 'check_circle', color: 'text-sky-600 bg-sky-50' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-surface-container-lowest rounded-3xl sm:rounded-3xl p-4 sm:p-5 border border-outline-variant/20 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant leading-tight">{label}</p>
                <p className="font-sora font-bold text-primary text-xl leading-tight mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setShowCreateFormation(true)}
            className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 24 }}>add_circle</span>
            </div>
            <div className="text-left">
              <h3 className="font-sora font-bold text-primary text-base">Créer une formation</h3>
              <p className="text-xs text-on-surface-variant mt-1">Ajouter une nouvelle formation à votre catalogue</p>
            </div>
          </button>
          <button
            onClick={() => setShowBookingModal(true)}
            className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 24 }}>event</span>
            </div>
            <div className="text-left">
              <h3 className="font-sora font-bold text-primary text-base">Réserver un espace</h3>
              <p className="text-xs text-on-surface-variant mt-1">Louer un espace dans un coworking space</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formations */}
          <div>
            <h2 className="font-sora font-semibold text-primary text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>school</span>
              Mes formations
            </h2>
            {formations.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 text-center shadow-sm">
                <span className="material-symbols-outlined text-on-surface-variant/30 block mb-2" style={{ fontSize: 36 }}>school</span>
                <p className="text-sm text-on-surface-variant">Aucune formation créée.</p>
                <button
                  onClick={() => setShowCreateFormation(true)}
                  className="mt-3 text-xs font-semibold text-secondary hover:underline"
                >
                  Créer ma première formation
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formations.map((f) => {
                  const formInscrits = (inscriptions[f.id] || []).filter(i => i.statut !== 'annulee');
                  const nbInscrits = formInscrits.length;
                  const fillPct = f.capacite_max > 0 ? Math.min(100, Math.round((nbInscrits / f.capacite_max) * 100)) : 0;
                  const fillColor = fillPct >= 90 ? 'bg-red-500' : fillPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div key={f.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-4 shadow-sm">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-sora font-bold text-primary text-sm leading-snug flex-1">{f.titre}</h3>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUT_STYLES[f.statut]}`}>
                          {STATUT_LABELS[f.statut]}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-on-surface-variant mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                          {f.espaces?.nom || '—'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_today</span>
                          {new Date(f.date_debut).toLocaleDateString('fr-FR')}
                        </div>
                      </div>

                      {/* Barre de remplissage */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>group</span>
                            {nbInscrits} / {f.capacite_max} inscrits
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: fillPct >= 90 ? '#ef4444' : fillPct >= 60 ? '#f59e0b' : '#10b981' }}>
                            {fillPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${fillColor}`} style={{ width: `${fillPct}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/trainer/planning"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                        >
                          Voir le planning →
                        </Link>
                        <span className="text-outline-variant/40">·</span>
                        <button
                          onClick={() => setSelectedFormationParticipants(f)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>group</span>
                          Voir les inscrits ({nbInscrits})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Réservations */}
          <div>
            <h2 className="font-sora font-semibold text-primary text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 18 }}>chair</span>
              Mes réservations d'espaces
            </h2>
            {reservations.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 text-center shadow-sm">
                <span className="material-symbols-outlined text-on-surface-variant/30 block mb-2" style={{ fontSize: 36 }}>chair</span>
                <p className="text-sm text-on-surface-variant">Aucune réservation d'espace.</p>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="mt-3 text-xs font-semibold text-secondary hover:underline"
                >
                  Réserver un espace
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => (
                  <div key={r.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-sora font-bold text-primary text-sm leading-snug flex-1">{r.espaces?.nom}</h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${r.statut === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          r.statut === 'pending' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                        {r.statut === 'confirmed' ? 'Confirmée' : r.statut === 'pending' ? 'En attente' : 'Annulée'}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-on-surface-variant mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_today</span>
                        {new Date(r.date_debut).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                        {new Date(r.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(r.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Créer Formation */}
      {showCreateFormation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowCreateFormation(false)} />
          <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-start">
              <div>
                <h2 className="font-sora font-bold text-lg text-primary">Créer une formation</h2>
                <p className="text-xs text-on-surface-variant mt-1">Ajoutez une nouvelle formation à votre catalogue</p>
              </div>
              <button onClick={() => setShowCreateFormation(false)} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleCreateFormation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Titre *</label>
                    <input
                      type="text"
                      required
                      value={formationForm.titre}
                      onChange={(e) => setFormationForm({ ...formationForm, titre: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                      placeholder="Titre de la formation"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Capacité max *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formationForm.capacite_max}
                      onChange={(e) => setFormationForm({ ...formationForm, capacite_max: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                      placeholder="10"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Description</label>
                  <textarea
                    rows={3}
                    value={formationForm.description}
                    onChange={(e) => setFormationForm({ ...formationForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    placeholder="Description de la formation..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Espace (optionnel)</label>
                  <select
                    value={formationForm.espace_id}
                    onChange={(e) => setFormationForm({ ...formationForm, espace_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                  >
                    <option value="">-- Sélectionner un espace --</option>
                    {espaces.map((e) => (
                      <option key={e.id} value={e.id}>{e.nom} ({e.type})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Date de début *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formationForm.date_debut}
                      onChange={(e) => setFormationForm({ ...formationForm, date_debut: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Date de fin *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formationForm.date_fin}
                      onChange={(e) => setFormationForm({ ...formationForm, date_fin: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Prix d'inscription (DT)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={formationForm.prix_inscription}
                    onChange={(e) => setFormationForm({ ...formationForm, prix_inscription: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Programme</label>
                  <textarea
                    rows={2}
                    value={formationForm.programme}
                    onChange={(e) => setFormationForm({ ...formationForm, programme: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    placeholder="Contenu détaillé de la formation..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Prérequis</label>
                  <input
                    type="text"
                    value={formationForm.prerequis}
                    onChange={(e) => setFormationForm({ ...formationForm, prerequis: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    placeholder="Prérequis nécessaires..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Matériel à apporter</label>
                  <input
                    type="text"
                    value={formationForm.materiel}
                    onChange={(e) => setFormationForm({ ...formationForm, materiel: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm"
                    placeholder="Matériel requis..."
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>
                )}
              </form>
            </div>
            <div className="p-4 border-t border-outline-variant/20 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateFormation(false)}
                className="flex-1 py-2.5 border border-outline-variant/40 text-on-surface-variant font-semibold rounded-xl text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateFormation}
                className="flex-1 py-2.5 bg-secondary text-white font-semibold rounded-xl text-sm hover:bg-secondary/90"
              >
                Créer la formation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réserver Espace */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowBookingModal(false)} />
          <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-start bg-gradient-to-r from-emerald-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 24 }}>event</span>
                </div>
                <div>
                  <h2 className="font-sora font-bold text-xl text-primary">Réserver un espace</h2>
                  <p className="text-sm text-on-surface-variant mt-0.5">Sélectionnez un espace et définissez vos horaires</p>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="w-10 h-10 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Sélection de l'espace */}
                <div className="p-6 border-r border-outline-variant/20">
                  <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>location_on</span>
                    Choisissez un espace
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {espaces.map((espace) => (
                      <div
                        key={espace.id}
                        onClick={() => {
                          setBookingForm({ ...bookingForm, espace_id: espace.id });
                          setSelectedEspace(espace);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${selectedEspace?.id === espace.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-outline-variant/20 hover:border-emerald-300'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedEspace?.id === espace.id ? 'bg-emerald-100' : 'bg-surface-container-low'
                            }`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                              {espace.type === 'meeting_room' ? 'meeting_room' :
                                espace.type === 'training_room' ? 'school' :
                                  espace.type === 'private_office' ? 'desk' :
                                    espace.type === 'open_space' ? 'weekend' : 'event_seat'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-primary text-sm">{espace.nom}</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5 capitalize">{espace.type.replace('_', ' ')}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-semibold text-emerald-600">{espace.tarif_horaire} DT/h</span>
                              <span className="text-xs text-on-surface-variant">•</span>
                              <span className="text-xs text-on-surface-variant">{espace.capacite} personnes</span>
                            </div>
                          </div>
                          {selectedEspace?.id === espace.id && (
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Détails de la réservation */}
                <div className="p-6 bg-surface-container-lowest">
                  <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>schedule</span>
                    Détails de la réservation
                  </h3>

                  {selectedEspace ? (
                    <form onSubmit={handleCreateBooking} className="space-y-4">
                      {/* Récapitulatif de l'espace */}
                      <div className="p-4 rounded-2xl bg-white border border-outline-variant/20">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 24 }}>
                              {selectedEspace.type === 'meeting_room' ? 'meeting_room' :
                                selectedEspace.type === 'training_room' ? 'school' :
                                  selectedEspace.type === 'private_office' ? 'desk' :
                                    selectedEspace.type === 'open_space' ? 'weekend' : 'event_seat'}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-primary">{selectedEspace.nom}</h4>
                            <p className="text-xs text-on-surface-variant capitalize">{selectedEspace.type.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-on-surface-variant">Date de début *</label>
                          <input
                            type="datetime-local"
                            required
                            value={bookingForm.date_debut}
                            onChange={(e) => setBookingForm({ ...bookingForm, date_debut: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-on-surface-variant">Date de fin *</label>
                          <input
                            type="datetime-local"
                            required
                            value={bookingForm.date_fin}
                            onChange={(e) => setBookingForm({ ...bookingForm, date_fin: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Estimation du prix */}
                      {bookingForm.date_debut && bookingForm.date_fin && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 20 }}>payments</span>
                              <span className="text-sm font-semibold text-emerald-800">Estimation du prix</span>
                            </div>
                            <div className="text-right">
                              <span className="font-sora font-bold text-2xl text-emerald-700">{calculateEstimatedPrice()}</span>
                              <span className="text-sm font-semibold text-emerald-600 ml-1">DT</span>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-700 mt-1">
                            {selectedEspace.tarif_horaire} DT/h × {((new Date(bookingForm.date_fin) - new Date(bookingForm.date_debut)) / (1000 * 60 * 60)).toFixed(1)}h
                          </p>
                        </div>
                      )}

                      {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                          {error}
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 32 }}>location_searching</span>
                      </div>
                      <p className="text-sm text-on-surface-variant">Sélectionnez un espace pour continuer</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 bg-white flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowBookingModal(false);
                  setSelectedEspace(null);
                  setBookingForm({ espace_id: '', date_debut: '', date_fin: '' });
                }}
                className="px-6 py-3 border border-outline-variant/40 text-on-surface-variant font-semibold rounded-xl text-sm hover:bg-surface-container transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={!selectedEspace || !bookingForm.date_debut || !bookingForm.date_fin}
                className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                Confirmer la réservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Liste des Participants ── */}
      {selectedFormationParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setSelectedFormationParticipants(null)} />
          <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header modal */}
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-start" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 22 }}>group</span>
                </div>
                <div>
                  <h2 className="font-sora font-bold text-lg text-primary leading-snug">{selectedFormationParticipants.titre}</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {(inscriptions[selectedFormationParticipants.id] || []).filter(i => i.statut !== 'annulee').length} inscrits actifs · capacité {selectedFormationParticipants.capacite_max}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFormationParticipants(null)}
                className="w-9 h-9 rounded-xl hover:bg-violet-100 flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Corps du modal */}
            <div className="flex-1 overflow-y-auto p-5">
              {(inscriptions[selectedFormationParticipants.id] || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30 block mb-3" style={{ fontSize: 48 }}>group_off</span>
                  <p className="text-sm font-semibold text-on-surface-variant">Aucun participant inscrit</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">Les inscriptions apparaîtront ici.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* En-tête tableau */}
                  <div className="grid grid-cols-12 gap-2 px-3 pb-2 border-b border-outline-variant/20">
                    <span className="col-span-5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Participant</span>
                    <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Inscription</span>
                    <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Paiement</span>
                    <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center">Présence</span>
                  </div>

                  {(inscriptions[selectedFormationParticipants.id] || []).map((insc) => (
                    <div
                      key={insc.id}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-2xl border transition-colors ${
                        insc.statut === 'annulee'
                          ? 'border-red-100 bg-red-50/40 opacity-60'
                          : 'border-outline-variant/15 hover:bg-surface-container-low'
                      }`}
                    >
                      {/* Nom + email */}
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-white"
                          style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed)' }}
                        >
                          {(insc.profiles?.prenom?.[0] || '').toUpperCase()}{(insc.profiles?.nom?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary truncate">
                            {insc.profiles?.prenom} {insc.profiles?.nom}
                          </p>
                          <p className="text-[10px] text-on-surface-variant truncate">{insc.profiles?.email}</p>
                        </div>
                      </div>

                      {/* Statut inscription */}
                      <div className="col-span-3">
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${INSCRIT_STATUT_STYLES[insc.statut] || 'bg-slate-100 text-slate-700'}`}>
                          {INSCRIT_STATUT_LABELS[insc.statut] || insc.statut}
                        </span>
                      </div>

                      {/* Statut paiement */}
                      <div className="col-span-2">
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${PAIEMENT_STYLES[insc.statut_paiement] || 'bg-slate-100 text-slate-700'}`}>
                          {PAIEMENT_LABELS[insc.statut_paiement] || insc.statut_paiement}
                        </span>
                      </div>

                      {/* Présence */}
                      <div className="col-span-2 flex justify-center">
                        {insc.present ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>radio_button_unchecked</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center">
              <p className="text-xs text-on-surface-variant">
                {(inscriptions[selectedFormationParticipants.id] || []).filter(i => i.present).length} présences confirmées
              </p>
              <button
                onClick={() => setSelectedFormationParticipants(null)}
                className="px-5 py-2 bg-violet-600 text-white font-semibold rounded-xl text-sm hover:bg-violet-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
