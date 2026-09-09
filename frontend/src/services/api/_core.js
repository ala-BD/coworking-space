// services/api/_core.js — Client HTTP partagé (fetch + auth JWT)
import { supabase } from '../../supabaseClient';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SESSION_EXPIRED_MESSAGE = 'Session expirée. Veuillez vous reconnecter.';

function isAuthError(status, message = '') {
  return status === 401
    || message.includes('JWT')
    || message.includes('Token JWT')
    || message.includes('Session expirée');
}

export async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(SESSION_EXPIRED_MESSAGE);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  if (expiresAt <= now + 60) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) throw new Error(SESSION_EXPIRED_MESSAGE);
    return refreshed.session.access_token;
  }
  return session.access_token;
}

export async function getAuthHeaders() {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetch(path, options = {}, retried = false) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && !retried) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed.session?.access_token) {
      return apiFetch(path, options, true);
    }
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (!response.ok) {
    const message = body.error || `Erreur API (${response.status})`;
    if (isAuthError(response.status, message)) throw new Error(SESSION_EXPIRED_MESSAGE);
    const err = new Error(message);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}
