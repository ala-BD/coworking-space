import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SESSION_EXPIRED_MESSAGE = 'Session expirée. Veuillez vous reconnecter.';

function isAuthError(status, message = '') {
  return status === 401
    || message.includes('JWT')
    || message.includes('Token JWT')
    || message.includes('Session expirée');
}

async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  if (expiresAt <= now + 60) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }
    return refreshed.session.access_token;
  }

  return session.access_token;
}

async function getAuthHeaders() {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function apiFetch(path, options = {}, retried = false) {
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
    if (isAuthError(response.status, message)) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }
    throw new Error(message);
  }

  return body;
}

export const bookingApi = {
  checkAvailability: (payload) =>
    apiFetch('/api/bookings/check-availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCalendar: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/calendar?${qs}`);
  },
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings${qs ? `?${qs}` : ''}`);
  },
  create: (payload) =>
    apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  cancel: (id) =>
    apiFetch(`/api/bookings/${id}`, { method: 'DELETE' }),
  getOccupation: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/occupation?${qs}`);
  },
  getEspaces: () => apiFetch('/api/espaces'),
};

export const memberApi = {
  getMe: () => apiFetch('/api/members/me'),
  updateMe: (payload) => apiFetch('/api/members/me', { method: 'PUT', body: JSON.stringify(payload) }),
  addDocument: (payload) =>
    apiFetch('/api/members/me/documents', { method: 'POST', body: JSON.stringify(payload) }),
  removeDocument: (index) =>
    apiFetch(`/api/members/me/documents/${index}`, { method: 'DELETE' }),
  getQr: () => apiFetch('/api/members/me/qr'),
  getAll: () => apiFetch('/api/members'),
  getById: (id) => apiFetch(`/api/members/${id}`),
  updateById: (id, payload) =>
    apiFetch(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getPendingAccounts: () => apiFetch('/api/admin/pending-accounts'),
  approveAccount: (id, action) =>
    apiFetch(`/api/admin/approve-account/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
};

export const subscriptionApi = {
  getMine: () => apiFetch('/api/subscriptions/me'),
  getActive: () => apiFetch('/api/subscriptions/me/active'),
  selfSubscribe: (payload) =>
    apiFetch('/api/subscriptions/self', { method: 'POST', body: JSON.stringify(payload) }),
};

export const sessionApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/sessions${qs ? `?${qs}` : ''}`);
  },
  getMine: () => apiFetch('/api/sessions/me'),
  getActive: () => apiFetch('/api/sessions/me/active'),
  checkIn: (payload) =>
    apiFetch('/api/sessions/check-in', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload) =>
    apiFetch('/api/sessions/check-out', { method: 'POST', body: JSON.stringify(payload) }),
};

export const settingsApi = {
  getCancellationPolicy: () => apiFetch('/api/settings/cancellation-policy'),
  updateCancellationPolicy: (payload) =>
    apiFetch('/api/settings/cancellation-policy', { method: 'PATCH', body: JSON.stringify(payload) }),
};

export const pricingApi = {
  getPlans: () => apiFetch('/api/pricing'),
  getAllPlans: () => apiFetch('/api/pricing/all'),
  createPlan: (payload) =>
    apiFetch('/api/pricing', { method: 'POST', body: JSON.stringify(payload) }),
  updatePlan: (id, payload) =>
    apiFetch(`/api/pricing/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  validatePromo: (payload) =>
    apiFetch('/api/promo-codes/validate', { method: 'POST', body: JSON.stringify(payload) }),
  getPromoCodes: () => apiFetch('/api/promo-codes'),
  createPromoCode: (payload) =>
    apiFetch('/api/promo-codes', { method: 'POST', body: JSON.stringify(payload) }),
  updatePromoCode: (id, payload) =>
    apiFetch(`/api/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getMyHistory: () => apiFetch('/api/pricing/history/me'),
};

// ── MODULE G — Formateurs & Formations ────────────────────────────────────
export const formationApi = {
  // ── Formateurs ──────────────────────────────────────────────────────────
  getFormateurs: () => apiFetch('/api/formateurs'),
  getFormateur: (id) => apiFetch(`/api/formateurs/${id}`),
  createFormateur: (payload) =>
    apiFetch('/api/formateurs', { method: 'POST', body: JSON.stringify(payload) }),
  updateFormateur: (id, payload) =>
    apiFetch(`/api/formateurs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addRemuneration: (formateurId, payload) =>
    apiFetch(`/api/formateurs/${formateurId}/remuneration`, { method: 'POST', body: JSON.stringify(payload) }),

  // ── Formations ──────────────────────────────────────────────────────────
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/formations${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => apiFetch(`/api/formations/${id}`),
  create: (payload) =>
    apiFetch('/api/formations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/formations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) =>
    apiFetch(`/api/formations/${id}`, { method: 'DELETE' }),

  // ── Inscriptions ────────────────────────────────────────────────────────
  inscrire: (formationId) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`, { method: 'POST' }),
  desinscrire: (formationId, userId) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`, {
      method: 'DELETE',
      body: JSON.stringify(userId ? { user_id: userId } : {}),
    }),
  getParticipants: (formationId) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`),
  marquerPresence: (formationId, userId, present) =>
    apiFetch(`/api/formations/${formationId}/inscriptions/${userId}/presence`, {
      method: 'PATCH',
      body: JSON.stringify({ present }),
    }),
  getEmargement: (formationId) =>
    apiFetch(`/api/formations/${formationId}/emargement`),

  // ── Espace membre ────────────────────────────────────────────────────────
  getMesFormations: () => apiFetch('/api/members/me/formations'),
  createFormationPayment: (formationId) => apiFetch(`/api/formations/${formationId}/inscriptions/payment`, { method: 'POST' }),
};

// ── MODULE D — KPIs & Dashboard ────────────────────────────────────────────
export const kpiApi = {
  // Tous les KPIs en un appel (auto-refresh silencieux)
  getAll: () => apiFetch('/api/admin/kpis'),

  // Graphiques CA + occupation sur 6 mois
  getRevenueChart: () => apiFetch('/api/admin/kpis/revenue-chart'),
};

export const paymentApi = {
  getAll: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/payments?${qs}`);
  },
  getMemberPayments: (memberId) => apiFetch(`/api/payments/member/${memberId}`),
  createSelf: (payload) =>
    apiFetch('/api/payments/self', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/payments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  downloadReceipt: async (id) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/payments/${id}/receipt`, {
      headers: { ...headers },
    });
    if (!response.ok) throw new Error('Erreur de téléchargement');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },
  payWithStripe: (paymentId) =>
    apiFetch('/api/stripe/pay', { method: 'POST', body: JSON.stringify({ paymentId }) }),
  verifyStripe: (paymentId, sessionId) =>
    apiFetch('/api/stripe/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, session_id: sessionId || undefined }),
    }),
};

// ── MODULE E — Portail Membre ────────────────────────────────────────────
export const memberPortalApi = {
  getBookingsHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/history?${qs}`);
  },
  getStats: () => apiFetch('/api/member/stats'),
  getNotifications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/member/notifications?${qs}`);
  },
  markNotificationRead: (id) =>
    apiFetch(`/api/member/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    apiFetch('/api/member/notifications/read-all', { method: 'POST' }),
  updateSettings: (payload) =>
    apiFetch('/api/members/me/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
};

// ── Messagerie ──────────────────────────────────────────────────────────
export const messagingApi = {
  getConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/conversations?${qs}`);
  },
  createConversation: (payload) =>
    apiFetch('/api/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  getConversation: (id) => apiFetch(`/api/conversations/${id}`),
  getMessages: (convId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/conversations/${convId}/messages?${qs}`);
  },
  sendMessage: (convId, content) =>
    apiFetch(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  markAsRead: (convId) =>
    apiFetch(`/api/conversations/${convId}/read`, { method: 'PATCH' }),
  getUnreadCount: () => apiFetch('/api/messages/unread-count'),
  // Admin
  getAdminConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/admin/conversations?${qs}`);
  },
  createAdminConversation: (payload) =>
    apiFetch('/api/admin/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  searchMembers: (search) =>
    apiFetch(`/api/admin/members?search=${encodeURIComponent(search)}`),
};

// ── MODULE H — Guests ───────────────────────────────────────────────────
export const guestApi = {
  create: (payload) =>
    fetch(`${API_URL}/api/guests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  booking: (payload) =>
    fetch(`${API_URL}/api/guests/booking`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  formation: (payload) =>
    fetch(`${API_URL}/api/guests/formation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  cancelByToken: (token) =>
    fetch(`${API_URL}/api/guests/booking/${token}`, { method: 'DELETE' }).then(r => r.json()),
  getAll: () => apiFetch('/api/guests'),
  convert: (id, payload) =>
    apiFetch(`/api/guests/${id}/convert`, { method: 'POST', body: JSON.stringify(payload) }),
};

// ── MODULE J — Politique annulation avancée + Crédits ──────────────────
export const cancellationAdvancedApi = {
  getPoliciesByEspace: () => apiFetch('/api/cancellation-policies/espaces'),
  upsertPolicyEspace: (payload) =>
    apiFetch('/api/cancellation-policies/espaces', { method: 'PUT', body: JSON.stringify(payload) }),
  markNoShow: (reservationId) =>
    apiFetch(`/api/bookings/${reservationId}/noshow`, { method: 'POST' }),
  getCredits: (userId) => apiFetch(`/api/members/${userId}/credits`),
  addCredit: (userId, payload) =>
    apiFetch(`/api/members/${userId}/credits`, { method: 'POST', body: JSON.stringify(payload) }),
};

// ── MODULE K — Documents membres ────────────────────────────────────────
export const documentsApi = {
  getContent: (type) =>
    fetch(`${API_URL}/api/documents/content/${type}`).then(r => r.json()),
  setContent: (payload) =>
    apiFetch('/api/documents/content', { method: 'PUT', body: JSON.stringify(payload) }),
  getMyDocuments: () => apiFetch('/api/members/me/documents-k'),
  upload: (payload) =>
    apiFetch('/api/members/me/documents-k', { method: 'POST', body: JSON.stringify(payload) }),
  accept: (type_doc) =>
    apiFetch('/api/members/me/accept', { method: 'POST', body: JSON.stringify({ type_doc }) }),
  getSignDocument: (token) =>
    fetch(`${API_URL}/api/documents/sign/${token}`).then(r => r.json()),
  signDocument: (token) =>
    fetch(`${API_URL}/api/documents/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json()),
  getMemberDocuments: (userId) => apiFetch(`/api/admin/members/${userId}/documents`),
  sendSignature: (userId, payload) =>
    apiFetch(`/api/admin/members/${userId}/documents/send-signature`, { method: 'POST', body: JSON.stringify(payload) }),
};

// ── MODULE L — RGPD ─────────────────────────────────────────────────────
export const rgpdApi = {
  submitRequest: (payload) =>
    apiFetch('/api/rgpd/request', { method: 'POST', body: JSON.stringify(payload) }),
  getMyRequests: () => apiFetch('/api/rgpd/my-requests'),
  updateMarketing: (payload) =>
    apiFetch('/api/members/me/marketing', { method: 'PATCH', body: JSON.stringify(payload) }),
  getAdminRequests: () => apiFetch('/api/admin/rgpd'),
  processRequest: (id, payload) =>
    apiFetch(`/api/admin/rgpd/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};

// ── Admin — Coworking setup & espaces ────────────────────────────────────
export const tenantAdminApi = {
  getTenant: () => apiFetch('/api/admin/tenant'),
  updateTenant: (payload) =>
    apiFetch('/api/admin/tenant', { method: 'PATCH', body: JSON.stringify(payload) }),
  createEspace: (payload) =>
    apiFetch('/api/admin/espaces', { method: 'POST', body: JSON.stringify(payload) }),
  updateEspace: (id, payload) =>
    apiFetch(`/api/admin/espaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteEspace: (id) =>
    apiFetch(`/api/admin/espaces/${id}`, { method: 'DELETE' }),
  completeOnboarding: () =>
    apiFetch('/api/admin/onboarding/complete', { method: 'POST' }),
};

export const sitesApi = {
  getAll: () => apiFetch('/api/sites'),
  create: (payload) =>
    apiFetch('/api/sites', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/sites/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) =>
    apiFetch(`/api/sites/${id}`, { method: 'DELETE' }),
  getMembers: (siteId) => apiFetch(`/api/sites/${siteId}/members`),
  addMember: (siteId, userId) =>
    apiFetch(`/api/sites/${siteId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeMember: (siteId, userId) =>
    apiFetch(`/api/sites/${siteId}/members/${userId}`, { method: 'DELETE' }),
  getKpis: (siteId) => apiFetch(`/api/sites/${siteId}/kpis`),
  getGlobalKpis: () => apiFetch('/api/sites/kpis/global'),
};
