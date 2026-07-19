import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi, paymentApi, pricingApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { getRoleLabel } from '../utils/roles';

const BOOKING_STATUT_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
};

function StatCard({ label, value, icon, to, accent }) {
  const accentColor = accent || '#0054cb';
  const accentBg = accent
    ? (accent === '#2fbe8f' ? 'rgba(47,190,143,0.1)'
      : accent === '#ba1a1a' ? 'rgba(186,26,26,0.09)'
      : 'rgba(0,84,203,0.09)')
    : 'rgba(0,84,203,0.09)';

  const content = (
    <div
      className="bg-white rounded-3xl border border-outline-variant/10 h-full transition-all duration-300 hover:-translate-y-1"
      style={{ padding: '20px 22px', boxShadow: '0 4px 16px rgba(16,35,63,0.06)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{ background: accentBg, color: accentColor }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <p className="font-sora font-bold text-primary" style={{ fontSize: 24 }}>{value}</p>
      {to && (
        <p className="text-xs text-on-surface-variant mt-2 font-medium">Voir le détail →</p>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} className="block no-underline hover:no-underline">{content}</Link>;
  }
  return content;
}

export default function AdminDashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    pendingBookings: 0,
    confirmedBookings: 0,
    pendingPayments: 0,
    activeTarifs: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [session]);

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
      setProfile(prof);

      const [bookingsData, paymentsData, tarifsData] = await Promise.all([
        bookingApi.getAll(),
        paymentApi.getAll(),
        pricingApi.getAllPlans(),
      ]);

      const bookings = bookingsData.reservations || [];
      const payments = paymentsData.payments || [];
      const tarifs = tarifsData.tarifs || [];

      setStats({
        pendingBookings: bookings.filter((b) => b.statut === 'pending').length,
        confirmedBookings: bookings.filter((b) => b.statut === 'confirmed').length,
        pendingPayments: payments.filter((p) => p.statut === 'pending').length,
        activeTarifs: tarifs.filter((t) => t.actif).length,
      });

      setRecentBookings(
        bookings
          .filter((b) => b.statut === 'pending')
          .slice(0, 5)
      );
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
          className="w-14 h-14 rounded-full border-4 animate-spin mb-4"
          style={{ borderColor: 'rgba(0,84,203,0.15)', borderTopColor: '#0054cb' }}
        />
        <p className="text-sm text-on-surface-variant font-medium">Chargement…</p>
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      {/* ── En-tête ── */}
      <header className="mb-7 animate-fade-up">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-sora font-bold text-primary" style={{ fontSize: 28, lineHeight: '36px' }}>
              {greeting()}, {profile?.prenom || 'Admin'} 👋
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Tableau de bord administration — {getRoleLabel(profile?.role)}
            </p>
          </div>
          <span
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(0,84,203,0.08)', color: '#0054cb', border: '1px solid rgba(0,84,203,0.15)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>admin_panel_settings</span>
            Administration
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7 animate-fade-up delay-100">
        <StatCard
          label="Réservations en attente"
          value={stats.pendingBookings}
          icon="pending_actions"
          to="/admin/pricing"
          accent="#f59e0b"
        />
        <StatCard
          label="Réservations confirmées"
          value={stats.confirmedBookings}
          icon="event_available"
          to="/admin/pricing"
          accent="#2fbe8f"
        />
        <StatCard
          label="Paiements en attente"
          value={stats.pendingPayments}
          icon="payments"
          to="/admin/payments"
          accent="#ba1a1a"
        />
        <StatCard
          label="Tarifs actifs"
          value={stats.activeTarifs}
          icon="sell"
          to="/admin/pricing"
          accent="#0054cb"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-7 space-y-md">
          <div className="bg-white rounded-3xl p-lg custom-shadow border border-outline-variant/10">
            <div className="flex items-center justify-between mb-md">
              <h2 className="font-sora text-headline-sm text-primary">Réservations à valider</h2>
              <Link to="/admin/pricing" className="text-secondary font-semibold text-label-sm hover:underline">
                Gérer les réservations
              </Link>
            </div>
            {recentBookings.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Aucune réservation en attente de validation.</p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="py-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                    <div>
                      <p className="font-semibold text-primary">
                        {booking.profiles?.prenom} {booking.profiles?.nom}
                        {' · '}
                        {booking.espaces?.nom || 'Espace'}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {new Date(booking.date_debut).toLocaleString('fr-FR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <span className="self-start px-sm py-xs rounded-full text-label-sm font-semibold bg-surface-container-high text-on-surface-variant">
                      {BOOKING_STATUT_LABELS[booking.statut] || booking.statut}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-md">
          <div className="bg-primary text-white rounded-3xl p-lg custom-shadow relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
            <div className="relative z-10 space-y-md">
              <h2 className="font-sora text-headline-sm">Actions rapides</h2>
              <div className="flex flex-col gap-sm">
                <Link
                  to="/admin/pricing"
                  className="flex items-center gap-sm bg-white/10 hover:bg-white/15 rounded-lg px-4 py-3 transition-colors"
                >
                  <span className="material-symbols-outlined">sell</span>
                  <span className="font-semibold text-label-md">Tarifs & codes promo</span>
                </Link>
                <Link
                  to="/admin/pricing"
                  className="flex items-center gap-sm bg-white/10 hover:bg-white/15 rounded-lg px-4 py-3 transition-colors"
                >
                  <span className="material-symbols-outlined">calendar_month</span>
                  <span className="font-semibold text-label-md">Valider les réservations</span>
                </Link>
                <Link
                  to="/admin/payments"
                  className="flex items-center gap-sm bg-white/10 hover:bg-white/15 rounded-lg px-4 py-3 transition-colors"
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  <span className="font-semibold text-label-md">Suivre les paiements</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant/20">
            <div className="flex gap-sm items-start">
              <span className="material-symbols-outlined text-secondary">admin_panel_settings</span>
              <p className="text-body-sm text-on-surface-variant">
                Cet espace est réservé à la gestion du coworking. Les membres utilisent leur propre portail
                pour réserver un espace, consulter leurs factures et gérer leur abonnement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
