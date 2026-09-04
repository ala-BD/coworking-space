import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { getHomePath, isAdminRole, isMemberRole, canBookSpaces, getPostLoginPath } from '../../utils/roles';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );
}

export function RoleGuard({ session, requireAdmin = false, requireMember = false, requireTrainer = false, requireBooker = false, children }) {
  const [state, setState] = useState({ loading: true, role: null });

  useEffect(() => {
    if (!session?.user?.id) {
      setState({ loading: false, role: null });
      return;
    }

    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setState({ loading: false, role: data?.role ?? 'member' }))
      .catch(() => setState({ loading: false, role: 'member' }));
  }, [session]);

  if (state.loading) return <LoadingScreen />;

  if (requireAdmin && !isAdminRole(state.role)) {
    return <Navigate to={getHomePath(state.role)} replace />;
  }

  if (requireMember && !isMemberRole(state.role)) {
    return <Navigate to={getHomePath(state.role)} replace />;
  }

  if (requireTrainer && state.role !== 'formateur') {
    return <Navigate to={getHomePath(state.role)} replace />;
  }

  if (requireBooker && !canBookSpaces(state.role)) {
    return <Navigate to={getHomePath(state.role)} replace />;
  }

  return children;
}


export function HomeRedirect({ session }) {
  const [state, setState] = useState({ loading: true, path: '/dashboard' });

  useEffect(() => {
    if (!session?.user?.id) {
      setState({ loading: false, path: '/login' });
      return;
    }

    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data }) => {
        const path = await getPostLoginPath(supabase, session.user.id, data?.role);
        setState({ loading: false, path });
      })
      .catch(() => setState({ loading: false, path: '/dashboard' }));
  }, [session]);

  if (state.loading) return <LoadingScreen />;
  return <Navigate to={state.path} replace />;
}
