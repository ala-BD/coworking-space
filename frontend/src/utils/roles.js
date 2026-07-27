export const ADMIN_ROLES = ['admin', 'staff', 'super_admin'];

export const ROLE_LABELS = {
  member: 'Membre',
  admin: 'Administrateur',
  staff: 'Staff',
  formateur: 'Formateur',
  super_admin: 'Super Admin',
  guest: 'Invité',
};

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isMemberRole(role) {
  return !isAdminRole(role) && role !== 'formateur';
}

export function getHomePath(role) {
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (isAdminRole(role)) return '/admin/dashboard';
  if (role === 'formateur') return '/trainer/planning';
  return '/dashboard';
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || 'Membre';
}

export const MEMBER_NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', to: '/dashboard' },
  { id: 'member_bookings', label: 'Mes réservations', icon: 'calendar_month', to: '/dashboard/bookings' },
  { id: 'member_formations', label: 'Formations', icon: 'school', to: '/dashboard/formations' },
  { id: 'member_payments', label: 'Mes factures', icon: 'receipt_long', to: '/member/payments' },
  { id: 'abonnement', label: 'Abonnement & tarifs', icon: 'payments', to: '/dashboard/abonnement' },
  { id: 'qr', label: 'Mon accès QR', icon: 'qr_code_2', to: '/dashboard/qr' },
  { id: 'member_messages', label: 'Messagerie', icon: 'chat', to: '/dashboard/messages' },
  { id: 'book', label: 'Réserver un espace', icon: 'calendar_today', to: '/book/step1' },
  { id: 'member_notifications', label: 'Notifications', icon: 'notifications', to: '/dashboard/notifications' },
  { id: 'member_profile', label: 'Mon profil', icon: 'person', to: '/dashboard/profile' },
];

export const ADMIN_NAV = [
  { id: 'admin_dashboard', label: 'Tableau de bord', icon: 'dashboard', to: '/admin/dashboard' },
  { id: 'admin_agenda', label: 'Agenda & Check-in', icon: 'calendar_month', to: '/admin/agenda' },
  { id: 'admin_formations', label: 'Formations', icon: 'event_note', to: '/admin/formations' },
  { id: 'admin_pricing', label: 'Tarification', icon: 'sell', to: '/admin/pricing' },
  { id: 'admin_payments', label: 'Gestion paiements', icon: 'account_balance_wallet', to: '/admin/payments' },
  { id: 'admin_messages', label: 'Messagerie', icon: 'chat', to: '/admin/messages' },
  { id: 'admin_cancellation', label: 'Politique annulation', icon: 'gavel', to: '/admin/cancellation-policy' },
];

export const FORMATEUR_NAV = [
  { id: 'trainer_planning', label: 'Mon Planning', icon: 'event_note', to: '/trainer/planning' },
];

export const SUPER_ADMIN_NAV = [
  { id: 'sa_dashboard', label: 'Dashboard', icon: 'dashboard', to: '/super-admin/dashboard' },
  { id: 'sa_tenants', label: 'Tenant Management', icon: 'domain', to: '/super-admin/tenants' },
  { id: 'sa_billing', label: 'Facturation B2B', icon: 'payments', to: '/super-admin/billing' },
  { id: 'sa_monitoring', label: 'Monitoring & Audit', icon: 'monitor', to: '/super-admin/monitoring' },
];

