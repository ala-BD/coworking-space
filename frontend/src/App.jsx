import React, { useState, useEffect, lazy, Suspense } from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { supabase } from './supabaseClient';

const RoleGuard = lazy(() => import('./components/auth/RoleGuard').then((m) => ({ default: m.RoleGuard })));
const HomeRedirect = lazy(() => import('./components/auth/RoleGuard').then((m) => ({ default: m.HomeRedirect })));

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminPricing = lazy(() => import('./pages/AdminPricing'));
const MemberPayments = lazy(() => import('./pages/MemberPayments'));
const MemberSubscription = lazy(() => import('./pages/MemberSubscription'));
const StripeVerify = lazy(() => import('./pages/StripeVerify'));
const AdminCancellationPolicy = lazy(() => import('./pages/AdminCancellationPolicy'));
const AdminMessages = lazy(() => import('./pages/AdminMessages'));
const AdminAgenda = lazy(() => import('./pages/AdminAgenda'));
const BookingStep1 = lazy(() => import('./pages/BookingStep1'));
const BookingStep2 = lazy(() => import('./pages/BookingStep2'));
const BookingStep3 = lazy(() => import('./pages/BookingStep3'));
const QrCodeView = lazy(() => import('./pages/QrCodeView'));
const AdminFormations = lazy(() => import('./pages/AdminFormations'));
const AdminFormateurs = lazy(() => import('./pages/AdminFormateurs'));
const MemberFormations = lazy(() => import('./pages/MemberFormations'));
const MemberBookings = lazy(() => import('./pages/MemberBookings'));
const MemberProfile = lazy(() => import('./pages/MemberProfile'));
const MemberNotifications = lazy(() => import('./pages/MemberNotifications'));
const MemberMessages = lazy(() => import('./pages/MemberMessages'));
const TrainerPlanning = lazy(() => import('./pages/TrainerPlanning'));
const TrainerProfile = lazy(() => import('./pages/TrainerProfile'));
const TrainerDashboard = lazy(() => import('./pages/TrainerDashboard'));
const TrainerFormations = lazy(() => import('./pages/TrainerFormations'));
// Modules H, J, K, L, N
const GuestBookingPage = lazy(() => import('./pages/GuestBookingPage'));
const SignDocumentPage = lazy(() => import('./pages/SignDocumentPage'));
const MemberDocuments = lazy(() => import('./pages/MemberDocuments'));
const MemberRGPD = lazy(() => import('./pages/MemberRGPD'));
const AdminMultiSites = lazy(() => import('./pages/AdminMultiSites'));
const AdminOnboarding = lazy(() => import('./pages/AdminOnboarding'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const TenantManagement = lazy(() => import('./pages/TenantManagement'));
const TenantBilling = lazy(() => import('./pages/TenantBilling'));
const SuperAdminMonitoring = lazy(() => import('./pages/SuperAdminMonitoring'));
const SuperAdminUsers = lazy(() => import('./pages/SuperAdminUsers'));
const AdminEspaces = lazy(() => import('./pages/AdminEspaces'));
const AdminCoworkingProfile = lazy(() => import('./pages/AdminCoworkingProfile'));

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );
}

export default function App() {

  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const hasAuthParams = window.location.search.includes('code=') || window.location.hash.includes('access_token=');

    const checkUserStatusAndSetSession = async (s) => {
      if (s?.user?.id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('statut_compte')
            .eq('id', s.user.id)
            .single();

          if (!error && profile && profile.statut_compte && profile.statut_compte !== 'actif') {
            localStorage.setItem('pending_auth_status', profile.statut_compte);
            await supabase.auth.signOut();
            setSession(null);
            return false;
          }
        } catch (err) {
          console.error('Error checking account status:', err);
        }
      }
      setSession(s);
      return true;
    };

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      await checkUserStatusAndSetSession(s);
      if (!hasAuthParams || s) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      await checkUserStatusAndSetSession(s);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || s) {
        setLoading(false);
      }
    });

    let fallbackTimeout;
    if (hasAuthParams) {
      fallbackTimeout = setTimeout(() => {
        setLoading(false);
      }, 5000);
    }

    return () => {
      subscription.unsubscribe();
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, []);



  if (loading) {

    return (

      <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">

        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />

      </div>

    );

  }



  const ProtectedRoute = ({ children }) => {

    if (!session) return <Navigate to="/login" replace />;

    return children;

  };



  const MemberRoute = ({ children }) => (

    <ProtectedRoute>

      <RoleGuard session={session} requireMember>

        {children}

      </RoleGuard>

    </ProtectedRoute>

  );



  const AdminRoute = ({ children }) => (

    <ProtectedRoute>

      <RoleGuard session={session} requireAdmin>

        {children}

      </RoleGuard>

    </ProtectedRoute>

  );

  const TrainerRoute = ({ children }) => (

    <ProtectedRoute>

      <RoleGuard session={session} requireTrainer>

        {children}

      </RoleGuard>

    </ProtectedRoute>

  );

  const SuperAdminRoute = ({ children }) => (

    <ProtectedRoute>

      <RoleGuard session={session} requireAdmin>

        {children}

      </RoleGuard>

    </ProtectedRoute>

  );



  return (

    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>

          <Route path="/" element={<Landing session={session} />} />

          <Route

            path="/login"

            element={session ? <HomeRedirect session={session} /> : <Login />}

          />

          <Route

            path="/register"

            element={session ? <HomeRedirect session={session} /> : <Register />}

          />



          {/* Espace membre */}

          <Route

            path="/dashboard"

            element={

              <MemberRoute>

                <Dashboard session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/abonnement"

            element={

              <MemberRoute>

                <MemberSubscription session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/qr"

            element={

              <MemberRoute>

                <QrCodeView session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/bookings"

            element={

              <MemberRoute>

                <MemberBookings session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/profile"

            element={

              <MemberRoute>

                <MemberProfile session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/notifications"

            element={

              <MemberRoute>

                <MemberNotifications session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/messages"

            element={

              <MemberRoute>

                <MemberMessages session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/dashboard/formations"

            element={

              <MemberRoute>

                <MemberFormations session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/member/payments"

            element={

              <MemberRoute>

                <MemberPayments session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/member/payments/verify"

            element={

              <MemberRoute>

                <StripeVerify session={session} />

              </MemberRoute>

            }

          />

          <Route

            path="/book/step1"

            element={

              <MemberRoute>

                <BookingStep1 />

              </MemberRoute>

            }

          />

          <Route

            path="/book/step2"

            element={

              <MemberRoute>

                <BookingStep2 />

              </MemberRoute>

            }

          />

          <Route

            path="/book/step3"

            element={

              <MemberRoute>

                <BookingStep3 session={session} />

              </MemberRoute>

            }

          />



          {/* Espace administration */}

          <Route

            path="/admin/onboarding"

            element={

              <AdminRoute>

                <AdminOnboarding session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/dashboard"

            element={

              <AdminRoute>

                <AdminDashboard session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/pricing"

            element={

              <AdminRoute>

                <AdminPricing session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/payments"

            element={

              <AdminRoute>

                <AdminPayments session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/formations"

            element={

              <AdminRoute>

                <AdminFormations session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/espaces"

            element={

              <AdminRoute>

                <AdminEspaces session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/profile-coworking"

            element={

              <AdminRoute>

                <AdminCoworkingProfile session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/formateurs"

            element={

              <AdminRoute>

                <AdminFormateurs session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/cancellation-policy"

            element={

              <AdminRoute>

                <AdminCancellationPolicy session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/messages"

            element={

              <AdminRoute>

                <AdminMessages session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/admin/agenda"

            element={

              <AdminRoute>

                <AdminAgenda session={session} />

              </AdminRoute>

            }

          />

          <Route

            path="/trainer/planning"

            element={

              <TrainerRoute>

                <TrainerPlanning session={session} />

              </TrainerRoute>

            }

          />

          <Route

            path="/trainer/profile"

            element={

              <TrainerRoute>

                <TrainerProfile session={session} />

              </TrainerRoute>

            }

          />

          <Route

            path="/trainer-dashboard"

            element={

              <TrainerRoute>

                <TrainerDashboard session={session} />

              </TrainerRoute>

            }

          />

          <Route

            path="/trainer/formations"

            element={

              <TrainerRoute>

                <TrainerFormations session={session} />

              </TrainerRoute>

            }

          />

          <Route

            path="/super-admin/dashboard"

            element={

              <SuperAdminRoute>

                <SuperAdminDashboard session={session} />

              </SuperAdminRoute>

            }

          />

          <Route

            path="/super-admin/tenants"

            element={

              <SuperAdminRoute>

                <TenantManagement session={session} />

              </SuperAdminRoute>

            }

          />

          <Route

            path="/super-admin/users"

            element={

              <SuperAdminRoute>

                <SuperAdminUsers session={session} />

              </SuperAdminRoute>

            }

          />

          <Route

            path="/super-admin/billing"

            element={

              <SuperAdminRoute>

                <TenantBilling session={session} />

              </SuperAdminRoute>

            }

          />

          <Route

            path="/super-admin/monitoring"

            element={

              <SuperAdminRoute>

                <SuperAdminMonitoring session={session} />

              </SuperAdminRoute>

            }

          />



          <Route path="*" element={<Navigate to="/" replace />} />

          {/* ── Modules H, K, L, N — Pages publiques & membre ── */}
          <Route path="/book-guest" element={<GuestBookingPage />} />
          <Route path="/sign/:token" element={<SignDocumentPage />} />

          <Route path="/dashboard/documents" element={
            <MemberRoute><MemberDocuments session={session} /></MemberRoute>
          } />
          <Route path="/dashboard/rgpd" element={
            <MemberRoute><MemberRGPD session={session} /></MemberRoute>
          } />

          {/* ── Module N — Admin multi-sites ── */}
          <Route path="/admin/sites" element={
            <AdminRoute><AdminMultiSites session={session} /></AdminRoute>
          } />

        </Routes>
      </Suspense>
    </Router>

  );

}


