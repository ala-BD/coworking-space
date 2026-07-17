import React, { useState, useEffect } from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { supabase } from './supabaseClient';

import { RoleGuard, HomeRedirect } from './components/auth/RoleGuard';



import Landing from './pages/Landing';

import Login from './pages/Login';

import Register from './pages/Register';

import Dashboard from './pages/Dashboard';

import AdminDashboard from './pages/AdminDashboard';

import AdminPayments from './pages/AdminPayments';

import AdminPricing from './pages/AdminPricing';

import MemberPayments from './pages/MemberPayments';

import MemberSubscription from './pages/MemberSubscription';

import FlouciVerify from './pages/FlouciVerify';

import AdminCancellationPolicy from './pages/AdminCancellationPolicy';

import AdminAgenda from './pages/AdminAgenda';

import BookingStep1 from './pages/BookingStep1';

import BookingStep2 from './pages/BookingStep2';

import BookingStep3 from './pages/BookingStep3';

import QrCodeView from './pages/QrCodeView';



export default function App() {

  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    supabase.auth.getSession().then(({ data: { session: s } }) => {

      setSession(s);

      setLoading(false);

    });



    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {

      setSession(s);

    });



    return () => subscription.unsubscribe();

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



  return (

    <Router>

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

              <FlouciVerify session={session} />

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



        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

    </Router>

  );

}


