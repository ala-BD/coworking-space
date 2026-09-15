/**
 * useSessionUser — Extrait l'utilisateur courant sans appel réseau.
 *
 * Utilise en priorité la `session` passée en prop (déjà en mémoire dans App.jsx),
 * puis relit le localStorage en fallback pour les pages qui ne reçoivent pas session.
 *
 * Retourne : { userId, email, metadata }
 *   - userId   : string | null
 *   - email    : string | null
 *   - metadata : object (user_metadata du JWT — contient role, nom, prenom, etc.)
 */
export function useSessionUser(session) {
  // 1. Depuis la prop session (chemin le plus rapide)
  if (session?.user) {
    return {
      userId:   session.user.id,
      email:    session.user.email,
      metadata: session.user.user_metadata || {},
    };
  }

  // 2. Fallback : relire depuis localStorage (synchrone, 0 réseau)
  try {
    const authKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (authKey) {
      const parsed = JSON.parse(localStorage.getItem(authKey));
      const user = parsed?.user;
      const expiresAt = parsed?.expires_at;
      if (user && expiresAt && Date.now() / 1000 < expiresAt) {
        return {
          userId:   user.id,
          email:    user.email,
          metadata: user.user_metadata || {},
        };
      }
    }
  } catch (_) {}

  return { userId: null, email: null, metadata: {} };
}
