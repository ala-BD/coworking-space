import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { memberApi, subscriptionApi, bookingApi, sessionApi } from '../services/api';
import { connectSocket, joinUser, onSessionStarted, onSessionEnded, onSessionOvertime, onSessionAlert15Min, disconnectSocket } from '../services/socket';
import PortalLayout from '../components/layout/PortalLayout';
import { ROLE_LABELS } from '../utils/roles';

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

const STATUT_LABELS = {
  active: 'Actif',
  suspended: 'Suspendu',
  expired: 'Expiré',
};

const BOOKING_STATUT_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
};

function StatCard({ label, value, icon }) {
  return (
    <div
      className="bg-white rounded-3xl border border-outline-variant/10 transition-all duration-300 hover:-translate-y-1"
      style={{ padding: '20px 22px', boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{ background: 'rgba(0,84,203,0.09)', color: '#0054cb' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <p className="font-sora font-bold text-primary" style={{ fontSize: 18 }}>{value || '—'}</p>
    </div>
  );
}

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', cin: '', type_membre: 'individuel' });
  const [activeSession, setActiveSession] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    connectSocket();
    joinUser(session.user.id);

    const unsubs = [
      onSessionStarted((data) => {
        setActiveSession(data);
        if (data.reservations?.date_fin) {
          const remaining = Math.max(0, Math.floor((new Date(data.reservations.date_fin).getTime() - Date.now()) / 1000));
          setTimerSeconds(remaining);
        }
        loadData();
      }),
      onSessionEnded(() => {
        setActiveSession(null);
        setTimerSeconds(0);
        loadData();
      }),
      onSessionOvertime(() => {
        loadData();
      }),
      onSessionAlert15Min((data) => {
        setSuccess(`⚠️ Attention : moins de 15 minutes restantes pour votre session au ${data.espace?.nom || 'workspace'}.`);
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      disconnectSocket();
    };
  }, [session?.user?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [{ profile: prof }, { subscription }, { subscriptions }, { reservations }] = await Promise.all([
        memberApi.getMe(),
        subscriptionApi.getActive(),
        subscriptionApi.getMine(),
        bookingApi.getAll(),
      ]);
      setProfile(prof);
      setActiveSubscription(subscription);
      setSubscriptionHistory(subscriptions || []);
      setBookings(reservations || []);
      setForm({
        nom: prof.nom || '',
        prenom: prof.prenom || '',
        telephone: prof.telephone || '',
        cin: prof.cin || '',
        type_membre: prof.type_membre || 'individuel',
      });

      try {
        const { session: sess } = await sessionApi.getActive();
        setActiveSession(sess);
        if (sess?.reservations?.date_fin) {
          const remaining = Math.max(0, Math.floor((new Date(sess.reservations.date_fin).getTime() - Date.now()) / 1000));
          setTimerSeconds(remaining);
        }
      } catch {
        setActiveSession(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSession || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession) return;
    const poll = setInterval(() => {
      sessionApi.getActive().then(({ session: sess }) => {
        setActiveSession(sess);
        if (sess?.reservations?.date_fin) {
          const remaining = Math.max(0, Math.floor((new Date(sess.reservations.date_fin).getTime() - Date.now()) / 1000));
          setTimerSeconds(remaining);
        }
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(poll);
  }, [activeSession?.id]);

  const formatTimer = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCheckIn = async (reservationId) => {
    setCheckingIn(true);
    setError('');
    try {
      const { session: sess } = await sessionApi.checkIn({ reservation_id: reservationId });
      setActiveSession(sess);
      if (sess?.reservations?.date_fin) {
        const remaining = Math.max(0, Math.floor((new Date(sess.reservations.date_fin).getTime() - Date.now()) / 1000));
        setTimerSeconds(remaining);
      }
      setSuccess('Check-in réussi ! Bonne session.');
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeSession) return;
    setCheckingOut(true);
    setError('');
    try {
      await sessionApi.checkOut({ session_id: activeSession.id });
      setActiveSession(null);
      setTimerSeconds(0);
      setSuccess('Check-out enregistré. À bientôt !');
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    setCancellingId(id);
    setError('');
    setSuccess('');
    try {
      await bookingApi.cancel(id);
      setSuccess('Réservation annulée.');
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancellingId(null);
    }
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
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#f4f6f9' }}>
        <div
          className="w-14 h-14 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin mb-4"
          style={{ borderTopColor: '#0054cb' }}
        />
        <p className="text-sm text-on-surface-variant font-medium">Chargement…</p>
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      {/* ── En-tête salutation ── */}
      <header className="mb-7 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-sora font-bold text-primary" style={{ fontSize: 28, lineHeight: '36px' }}>
              {greeting()}, {profile?.prenom || 'Membre'}&nbsp;👋
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Espace membre — gérez votre profil, vos réservations et votre abonnement
            </p>
          </div>
          <Link
            to="/book/step1"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl shrink-0 transition-all hover:-translate-y-0.5"
            style={{ background: '#0054cb', boxShadow: '0 4px 14px rgba(0,84,203,0.3)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add_circle</span>
            Réserver
          </Link>
        </div>
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

      {/* Session active — B3 */}
      {activeSession && (
        <div className="mb-md bg-white rounded-3xl p-lg custom-shadow border border-secondary/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <div className="flex items-center gap-md">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary text-[32px]">timer</span>
              </div>
              <div>
                <div className="flex items-center gap-sm mb-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-label-sm font-semibold text-green-700 uppercase tracking-wider">Session en cours</span>
                </div>
                <p className="font-semibold text-primary">
                  {activeSession.reservations?.espaces?.nom || 'Espace'}
                  {activeSession.reservations?.espaces?.type && (
                    <span className="font-normal text-on-surface-variant capitalize">
                      {' · '}{activeSession.reservations.espaces.type.replace('_', ' ')}
                    </span>
                  )}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  Début : {new Date(activeSession.check_in).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                  {' · Fin prévue : '}
                  {activeSession.reservations?.date_fin
                    ? new Date(activeSession.reservations.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-md">
              <div className={`text-center px-lg py-sm rounded-xl ${timerSeconds <= 900 ? 'bg-red-50 border border-red-200' : 'bg-surface-container-low border border-outline-variant/20'}`}>
                <p className="text-body-xs text-on-surface-variant mb-xs">Temps restant</p>
                <p className={`font-mono text-headline-sm font-bold ${timerSeconds <= 900 ? 'text-red-600' : 'text-primary'}`}>
                  {formatTimer(timerSeconds)}
                </p>
                {timerSeconds <= 900 && timerSeconds > 0 && (
                  <p className="text-body-xs text-red-500 font-medium">Moins de 15 minutes</p>
                )}
                {timerSeconds === 0 && (
                  <p className="text-body-xs text-red-500 font-medium">Session terminée</p>
                )}
              </div>
              <button
                onClick={handleCheckOut}
                disabled={checkingOut}
                className="px-md py-3 bg-error text-white rounded-xl font-semibold hover:bg-error/90 transition-colors disabled:opacity-50 text-label-md"
              >
                {checkingOut ? '...' : 'Check-out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aujourd'hui — check-in rapide pour réservations du jour */}
      {!activeSession && bookings.filter((b) => {
        if (b.statut !== 'confirmed') return false;
        const debut = new Date(b.date_debut);
        const fin = new Date(b.date_fin);
        const now = new Date();
        return debut <= now && fin > now;
      }).length > 0 && (
        <div className="mb-md bg-white rounded-3xl p-lg custom-shadow border border-secondary/30">
          <div className="flex items-center gap-sm mb-md">
            <span className="material-symbols-outlined text-secondary">event_available</span>
            <h2 className="font-sora text-headline-sm text-primary">Réservation en cours</h2>
          </div>
          {bookings
            .filter((b) => {
              if (b.statut !== 'confirmed') return false;
              const debut = new Date(b.date_debut);
              const fin = new Date(b.date_fin);
              const now = new Date();
              return debut <= now && fin > now;
            })
            .map((booking) => (
              <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm py-sm border-t border-outline-variant/10 first:border-0 first:pt-0">
                <div>
                  <p className="font-semibold text-primary">{booking.espaces?.nom || 'Espace'}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {new Date(booking.date_debut).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                    {' → '}
                    {new Date(booking.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                  </p>
                </div>
                <button
                  onClick={() => handleCheckIn(booking.id)}
                  disabled={checkingIn}
                  className="px-md py-3 bg-secondary text-white rounded-xl font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 text-label-md self-start"
                >
                  {checkingIn ? '...' : 'Check-in'}
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8 space-y-md">
          <div className="bg-white rounded-3xl p-lg custom-shadow border border-outline-variant/10">
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

          {/* Mes réservations — Module B S2 */}
          <div className="bg-white rounded-3xl p-lg custom-shadow border border-outline-variant/10">
            <div className="flex items-center justify-between mb-md">
              <h2 className="font-sora text-headline-sm text-primary">Mes réservations</h2>
              <Link
                to="/book/step1"
                className="text-secondary font-semibold text-label-sm hover:underline"
              >
                + Nouvelle réservation
              </Link>
            </div>
            {bookings.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                Aucune réservation.{' '}
                <Link to="/book/step1" className="text-secondary font-semibold hover:underline">
                  Réservez un espace
                </Link>
                .
              </p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {bookings.map((booking) => (
                  <div key={booking.id} className="py-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                    <div>
                      <p className="font-semibold text-primary">
                        {booking.espaces?.nom || 'Espace'}
                        {' · '}
                        <span className="font-normal text-on-surface-variant capitalize">
                          {(booking.espaces?.type || '').replace('_', ' ')}
                        </span>
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {new Date(booking.date_debut).toLocaleString('fr-FR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {' → '}
                        {new Date(booking.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-sm self-start">
                      <span className={`px-sm py-xs rounded-full text-label-sm font-semibold ${
                        booking.statut === 'confirmed'
                          ? 'bg-secondary-fixed text-on-secondary-fixed'
                          : booking.statut === 'pending'
                            ? 'bg-surface-container-high text-on-surface-variant'
                            : 'bg-error-container/30 text-on-error-container'
                      }`}>
                        {BOOKING_STATUT_LABELS[booking.statut] || booking.statut}
                      </span>
                      {['pending', 'confirmed'].includes(booking.statut) && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="text-label-sm font-semibold text-error hover:underline disabled:opacity-50"
                        >
                          {cancellingId === booking.id ? 'Annulation...' : 'Annuler'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique abonnements — CDC A1 */}
          <div className="bg-white rounded-3xl p-lg custom-shadow border border-outline-variant/10">
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
                Consultez vos{' '}
                <Link to="/dashboard/abonnement" className="text-secondary font-semibold hover:underline">
                  tarifs & codes promo
                </Link>
                ,{' '}
                <Link to="/book/step1" className="text-secondary font-semibold hover:underline">
                  réservez un espace
                </Link>
                {' '}ou affichez votre{' '}
                <Link to="/dashboard/qr" className="text-secondary font-semibold hover:underline">
                  QR d&apos;accès
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-primary text-white rounded-3xl p-lg custom-shadow h-full relative overflow-hidden flex flex-col justify-between min-h-[280px]">
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
                    Souscrivez à un abonnement depuis la page{' '}
                    <Link to="/dashboard/abonnement" className="underline font-semibold">
                      Abonnement & tarifs
                    </Link>
                    .
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
