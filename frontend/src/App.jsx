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
const AdminAgenda = lazy(() => import('./pages/AdminAgenda'));
const BookingStep1 = lazy(() => import('./pages/BookingStep1'));
const BookingStep2 = lazy(() => import('./pages/BookingStep2'));
const BookingStep3 = lazy(() => import('./pages/BookingStep3'));
const QrCodeView = lazy(() => import('./pages/QrCodeView'));
const AdminFormations = lazy(() => import('./pages/AdminFormations'));
const AdminFormateurs = lazy(() => import('./pages/AdminFormateurs'));
const MemberFormations = lazy(() => import('./pages/MemberFormations'));
const TrainerPlanning = lazy(() => import('./pages/TrainerPlanning'));

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
    console.log('App Mounted. URL Search:', window.location.search);
    console.log('App Mounted. URL Hash:', window.location.hash);
    console.log('hasAuthParams:', hasAuthParams);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('getSession resolved. Session:', s);
      setSession(s);
      if (!hasAuthParams || s) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('onAuthStateChange Event:', event, 'Session:', s);
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || s) {
        setLoading(false);
      }
    });

    let fallbackTimeout;
    if (hasAuthParams) {
      console.log('Setting OAuth fallback timeout...');
      fallbackTimeout = setTimeout(() => {
        console.log('OAuth fallback timeout fired. Setting loading to false.');
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



        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
      </Suspense>
    </Router>

  );

}


