import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getPostLoginPath } from '../utils/roles';

/**
 * Page intermédiaire après un redirect OAuth (Google, LinkedIn).
 * Supabase redirige ici avec le token dans l'URL.
 * On vérifie le statut du compte puis on redirige vers la bonne page.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Connexion en cours…');

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Supabase detectSessionInUrl = true gère automatiquement l'échange du code
        // On attend que la session soit disponible
        const { data: { session }, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error || !session) {
          // Pas de session → retour login avec message d'erreur
          navigate('/login?error=oauth_failed', { replace: true });
          return;
        }

        // Charger le profil depuis la DB
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, statut_compte')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        // Profil introuvable = trigger DB absent ou délai de création
        // On réessaie une fois après 1 seconde
        if (profileError || !profile) {
          setMessage('Finalisation du compte…');
          await new Promise((r) => setTimeout(r, 1200));

          const { data: profileRetry } = await supabase
            .from('profiles')
            .select('role, statut_compte')
            .eq('id', session.user.id)
            .single();

          if (cancelled) return;

          if (!profileRetry) {
            // Toujours rien → trigger absent, déconnexion propre
            await supabase.auth.signOut();
            navigate('/login?error=profile_missing', { replace: true });
            return;
          }

          return finalize(session, profileRetry);
        }

        return finalize(session, profile);
      } catch (err) {
        if (!cancelled) {
          navigate('/login?error=oauth_failed', { replace: true });
        }
      }
    };

    const finalize = async (session, profile) => {
      // Compte en attente (admin coworking non validé)
      if (profile.statut_compte === 'en_attente') {
        await supabase.auth.signOut();
        navigate('/login?reason=pending', { replace: true });
        return;
      }

      // Compte suspendu ou autre statut non actif
      if (profile.statut_compte && profile.statut_compte !== 'actif') {
        await supabase.auth.signOut();
        navigate('/login?reason=suspended', { replace: true });
        return;
      }

      // Tout est bon → redirect vers la bonne page selon le rôle
      const path = await getPostLoginPath(supabase, session.user.id, profile.role);
      navigate(path, { replace: true });
    };

    handleCallback();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f4f1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid #e5e2de',
          borderTop: '4px solid #f95d00',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: '#6b6560', fontSize: 15, margin: 0 }}>{message}</p>

      {/* Keyframes inline pour le spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
