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
  const content = (
    <div className={`bg-white rounded-xl p-md custom-shadow border border-outline-variant/10 h-full ${to ? 'hover:border-secondary/40 transition-colors' : ''}`}>
      <div className="flex items-center gap-sm mb-xs">
        <span className={`material-symbols-outlined text-[20px] ${accent || 'text-secondary'}`}>{icon}</span>
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-sora text-headline-sm text-primary">{value}</p>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <header className="mb-lg">
        <h1 className="font-sora text-headline-lg text-primary">
          {greeting()}, {profile?.prenom || 'Admin'}.
        </h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Tableau de bord administration — {getRoleLabel(profile?.role)}
        </p>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md mb-lg">
        <StatCard
          label="Réservations en attente"
          value={stats.pendingBookings}
          icon="pending_actions"
          to="/admin/pricing"
        />
        <StatCard
          label="Réservations confirmées"
          value={stats.confirmedBookings}
          icon="event_available"
          to="/admin/pricing"
        />
        <StatCard
          label="Paiements en attente"
          value={stats.pendingPayments}
          icon="payments"
          to="/admin/payments"
        />
        <StatCard
          label="Tarifs actifs"
          value={stats.activeTarifs}
          icon="sell"
          to="/admin/pricing"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-7 space-y-md">
          <div className="bg-white rounded-xl p-lg custom-shadow border border-outline-variant/10">
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
          <div className="bg-primary text-white rounded-xl p-lg custom-shadow relative overflow-hidden">
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
