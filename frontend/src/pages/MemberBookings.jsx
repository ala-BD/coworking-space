import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { memberPortalApi, bookingApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmée', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  pending: { label: 'En attente', color: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  cancelled: { label: 'Annulée', color: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  completed: { label: 'Terminée', color: 'bg-slate-50 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
};

const FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'pending', label: 'En attente' },
  { key: 'completed', label: 'Terminées' },
  { key: 'cancelled', label: 'Annulées' },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(v) {
  return `${parseFloat(v || 0).toFixed(2)} DT`;
}

export default function MemberBookings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
      }
    });
  }, []);

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 8 };
      if (filter) params.statut = filter;
      const res = await memberPortalApi.getBookingsHistory(params);
      setBookings(res.bookings);
      setStats(res.stats);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadData(1); }, [loadData]);

  const handleCancel = async (id) => {
    setCancelling(id);
    try {
      await bookingApi.cancel(id);
      setCancelModal(null);
      loadData(pagination.page);
    } catch (err) {
      console.error('Annulation échouée:', err);
    }
    setCancelling(null);
  };

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (b.espaces?.nom || '').toLowerCase().includes(s) || (b.espaces?.type || '').toLowerCase().includes(s);
  });

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-sora text-2xl font-bold text-[#000d23]">Mes Réservations</h1>
            <p className="text-sm text-slate-500 mt-1">Historique complet de vos réservations</p>
          </div>
          <Link
            to="/book/step1"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0054cb] text-white rounded-2xl text-sm font-semibold hover:bg-[#0043a8] transition shadow-lg shadow-[#0054cb]/20"
          >
            <span className="material-symbols-rounded text-lg">add</span>
            Nouvelle Réservation
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: stats.total, icon: 'calendar_month', color: 'text-[#0054cb]' },
              { label: 'Confirmées', value: stats.confirmed, icon: 'check_circle', color: 'text-emerald-600' },
              { label: 'Heures totales', value: stats.totalHours, icon: 'schedule', color: 'text-amber-600' },
              { label: 'Montant total', value: formatCurrency(stats.totalSpent), icon: 'payments', color: 'text-[#000d23]' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-rounded text-2xl ${s.color}`}>{s.icon}</span>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{s.label}</p>
                    <p className="font-sora text-xl font-bold text-[#000d23]">{s.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Rechercher par espace, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0054cb]/30 focus:border-[#0054cb] transition bg-white"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition border ${
                  filter === f.key
                    ? 'bg-[#000d23] text-white border-[#000d23]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#0054cb] hover:text-[#0054cb]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Booking Cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0054cb]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <span className="material-symbols-rounded text-5xl text-slate-300">event_busy</span>
            <p className="mt-3 text-slate-500 font-medium">Aucune réservation trouvée</p>
            <Link to="/book/step1" className="mt-4 inline-flex items-center gap-1 text-[#0054cb] text-sm font-semibold hover:underline">
              Réserver maintenant
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => {
              const st = STATUS_CONFIG[b.statut] || STATUS_CONFIG.pending;
              const canCancel = b.statut === 'confirmed' || b.statut === 'pending';
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Espace icon */}
                    <div className="w-12 h-12 rounded-xl bg-[#0054cb]/8 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-rounded text-[#0054cb]">
                        {b.espaces?.type === 'bureau' ? 'desk' : b.espaces?.type === 'salle_reunion' ? 'groups' : b.espaces?.type === 'espace_commun' ? 'table_restaurant' : 'meeting_room'}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-sora font-semibold text-[#000d23] truncate">{b.espaces?.nom || 'Espace'}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${st.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {b.espaces?.type || '—'} &middot; {formatDate(b.date_debut)} &middot; {formatTime(b.date_debut)} – {formatTime(b.date_fin)}
                      </p>
                    </div>
                    {/* Montant + Actions */}
                    <div className="flex items-center gap-4">
                      <p className="font-sora font-bold text-[#000d23] text-right">{formatCurrency(b.montant_total)}</p>
                      {canCancel && (
                        <button
                          onClick={() => setCancelModal(b)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium opacity-0 group-hover:opacity-100 transition"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => loadData(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Précédent
            </button>
            <span className="text-sm text-slate-500 px-3">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => loadData(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCancelModal(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <span className="material-symbols-rounded text-red-500">warning</span>
              </div>
              <div>
                <h3 className="font-sora font-bold text-[#000d23]">Annuler la réservation</h3>
                <p className="text-xs text-slate-500">{cancelModal.espaces?.nom}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir annuler cette réservation ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
              >
                Garder
              </button>
              <button
                onClick={() => handleCancel(cancelModal.id)}
                disabled={cancelling === cancelModal.id}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                {cancelling === cancelModal.id ? 'Annulation...' : 'Annuler la réservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
