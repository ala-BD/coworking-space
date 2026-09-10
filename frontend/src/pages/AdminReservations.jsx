import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import Pagination from '../components/Pagination';

const STATUT_CONFIG = {
  pending: {
    label: 'En attente',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50',
    icon: 'hourglass_empty',
  },
  confirmed: {
    label: 'Confirmée',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
    icon: 'check_circle',
  },
  cancelled: {
    label: 'Annulée',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/50',
    icon: 'cancel',
  },
};

const ITEMS_PER_PAGE = 10;

export default function AdminReservations({ session }) {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [espaces, setEspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filtres
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterEspace, setFilterEspace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

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

      const [bookingsData, espacesData] = await Promise.all([
        bookingApi.getAll(),
        bookingApi.getEspaces().catch(() => ({ espaces: [] })),
      ]);

      setBookings(bookingsData.reservations || []);
      setEspaces(espacesData.espaces || []);
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

  const handleConfirmBooking = async (booking) => {
    const id = typeof booking === 'object' ? booking.id : booking;
    const mode = typeof booking === 'object' ? booking.mode : 'online';
    const isSurPlace = mode === 'sur_place' || mode === 'on_site';
    setActionId(id);
    try {
      await bookingApi.update(id, { statut: 'confirmed' });
      if (isSurPlace) {
        showToast('Réservation acceptée ! Le membre réglera sur place à l\'accueil le jour J.');
      } else {
        showToast('Réservation acceptée ! Le membre a désormais le droit de payer en ligne.');
      }
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Voulez-vous vraiment annuler cette réservation ?')) return;
    setActionId(id);
    try {
      await bookingApi.cancel(id);
      showToast('Réservation annulée avec succès.');
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  // Filtrage des réservations
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filterStatut !== 'all' && b.statut !== filterStatut) return false;
      if (filterEspace !== 'all' && b.espace_id !== filterEspace) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const memberName = `${b.profiles?.prenom || ''} ${b.profiles?.nom || ''}`.toLowerCase();
        const memberEmail = (b.profiles?.email || '').toLowerCase();
        const espaceName = (b.espaces?.nom || '').toLowerCase();
        const roleLabel = (b.profiles?.role === 'formateur' ? 'formateur' : 'membre').toLowerCase();
        if (!memberName.includes(q) && !memberEmail.includes(q) && !espaceName.includes(q) && !roleLabel.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, filterStatut, filterEspace, searchQuery]);

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatut, filterEspace, searchQuery]);

  // Découpage paginé (10 par page)
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.statut === 'pending').length;
    const confirmed = bookings.filter((b) => b.statut === 'confirmed').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const today = bookings.filter((b) => (b.date_debut || '').startsWith(todayStr)).length;
    return { total, pending, confirmed, today };
  }, [bookings]);

  const getReservationOwner = (booking) => {
    const profile = booking.profiles || {};
    const prenom = profile.prenom || '';
    const nom = profile.nom || '';
    const email = profile.email || '—';
    const role = profile.role === 'formateur' ? 'Formateur' : 'Membre';
    const fullName = [prenom, nom].filter(Boolean).join(' ') || 'Sans nom';
    return { fullName, email, role };
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
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-[9999] flex items-center gap-2.5 px-5 py-3.5 bg-emerald-600 text-white rounded-2xl shadow-xl text-sm font-semibold animate-fade-down">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-sora font-bold text-primary text-2xl sm:text-3xl">Gestion des Réservations</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Visualisez, confirmez et gérez toutes les réservations des espaces de coworking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/agenda"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant/30 text-primary rounded-xl font-semibold text-sm hover:bg-surface-container transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>calendar_month</span>
            <span>Voir l'Agenda</span>
          </Link>
          <button
            onClick={loadData}
            title="Rafraîchir"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-outline-variant/30 text-on-surface-variant hover:text-secondary hover:border-secondary transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center gap-2.5">
          <span className="material-symbols-outlined text-red-500">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <span className="material-symbols-outlined text-primary/60" style={{ fontSize: 20 }}>receipt_long</span>
          </div>
          <p className="font-sora font-bold text-2xl text-primary">{stats.total}</p>
          <p className="text-xs text-on-surface-variant mt-1">Toutes réservations</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">En attente</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>hourglass_top</span>
          </div>
          <p className="font-sora font-bold text-2xl text-amber-600">{stats.pending}</p>
          <p className="text-xs text-on-surface-variant mt-1">À confirmer</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Confirmées</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
          </div>
          <p className="font-sora font-bold text-2xl text-emerald-600">{stats.confirmed}</p>
          <p className="text-xs text-on-surface-variant mt-1">Validées sur l'agenda</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Aujourd'hui</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>today</span>
          </div>
          <p className="font-sora font-bold text-2xl text-secondary">{stats.today}</p>
          <p className="text-xs text-on-surface-variant mt-1">Séances prévues ce jour</p>
        </div>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="bg-white rounded-2xl border border-outline-variant/15 shadow-sm p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Recherche */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" style={{ fontSize: 20 }}>
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par membre, email, espace…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15 transition-all"
          />
        </div>

        {/* Filtres statut & espace */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant">Statut :</span>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-3 py-2 rounded-xl border border-outline-variant/30 text-sm font-medium bg-white outline-none focus:border-secondary transition-all"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant">Espace :</span>
            <select
              value={filterEspace}
              onChange={(e) => setFilterEspace(e.target.value)}
              className="px-3 py-2 rounded-xl border border-outline-variant/30 text-sm font-medium bg-white outline-none focus:border-secondary transition-all"
            >
              <option value="all">Tous les espaces</option>
              {espaces.map((es) => (
                <option key={es.id} value={es.id}>{es.nom}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des réservations */}
      <div className="bg-white rounded-3xl border border-outline-variant/15 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="py-3 px-3.5">Membre</th>
                <th className="py-3 px-3">Espace réservé</th>
                <th className="py-3 px-3">Date & Créneau</th>
                <th className="py-3 px-2.5 text-center">Paiement</th>
                <th className="py-3 px-2.5 text-center">Statut</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs sm:text-sm">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant/30 mb-2" style={{ fontSize: 44 }}>
                        event_busy
                      </span>
                      <p className="font-semibold text-sm text-primary">Aucune réservation trouvée</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Modifiez vos filtres ou attendez de nouvelles demandes de réservation.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b) => {
                  const cfg = STATUT_CONFIG[b.statut] || {
                    label: b.statut,
                    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
                    icon: 'info',
                  };

                  const member = b.profiles || b.guests || {};
                  const memberName = [member.prenom || b.guests?.prenom, member.nom || b.guests?.nom].filter(Boolean).join(' ') || 'Guest';
                  const memberEmail = member.email || b.guests?.email || 'Sans email';
                  const memberPhone = member.telephone || b.guests?.telephone || '';
                  const memberRole = member.role === 'formateur' ? 'Formateur' : 'Membre';
                  const startDate = new Date(b.date_debut);
                  const endDate = new Date(b.date_fin);
                  const isActing = actionId === b.id;

                  return (
                    <tr key={b.id} className="hover:bg-surface-container-low/40 transition-colors">
                      {/* Membre */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary font-bold flex items-center justify-center text-[11px] shrink-0">
                            {(member.prenom || b.guests?.prenom || 'G')?.[0] || 'G'}{(member.nom || b.guests?.nom || '')?.[0] || ''}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-primary truncate max-w-[150px] text-xs sm:text-sm">
                                {memberName}
                              </p>
                              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[9px] font-semibold">
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{memberRole === 'Formateur' ? 'school' : 'person'}</span>
                                {memberRole}
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant truncate max-w-[160px]">
                              {memberEmail}
                            </p>
                            {memberPhone && (
                              <p className="text-[10px] text-on-surface-variant/70 flex items-center gap-0.5 truncate">
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>call</span>
                                <span>{memberPhone}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Espace */}
                      <td className="py-2.5 px-3 font-semibold text-primary">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary shrink-0" style={{ fontSize: 16 }}>meeting_room</span>
                          <span className="truncate max-w-[130px] text-xs sm:text-sm" title={b.espaces?.nom}>{b.espaces?.nom || 'Espace inconnu'}</span>
                        </div>
                      </td>

                      {/* Date & Heures */}
                      <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">
                        <span className="font-medium text-primary text-xs sm:text-sm">
                          {startDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <div className="text-[11px] text-on-surface-variant/80 mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                          <span>
                            {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Mode de Paiement */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {(b.mode === 'sur_place' || b.mode === 'on_site' || b.mode === 'cash') ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 shadow-xs">
                            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 14 }}>storefront</span>
                            <span>Sur place</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 shadow-xs">
                            <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 14 }}>credit_card</span>
                            <span>En ligne</span>
                          </span>
                        )}
                      </td>

                      {/* Statut Badge */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badgeClass}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.statut === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmBooking(b)}
                              disabled={isActing}
                              title={b.mode === 'sur_place' || b.mode === 'on_site' ? "Accepter (paiement sur place à l'accueil)" : "Accepter (autorise le paiement en ligne)"}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
                              <span>Accepter</span>
                            </button>
                          )}

                          {['pending', 'confirmed'].includes(b.statut) && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(b.id)}
                              disabled={isActing}
                              title="Annuler la réservation"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                              <span>Annuler</span>
                            </button>
                          )}

                          <Link
                            to="/admin/agenda"
                            title="Voir dans le calendrier"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-secondary hover:border-secondary transition-all"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>calendar_month</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination 10 par page */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredBookings.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          label="réservations"
        />
      </div>
    </PortalLayout>
  );
}
