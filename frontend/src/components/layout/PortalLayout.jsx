import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabaseClient';
import {
  ADMIN_NAV,
  STAFF_NAV,
  MEMBER_NAV,
  FORMATEUR_NAV,
  SUPER_ADMIN_NAV,
  flattenNav,
  getHomePath,
  getRoleLabel,
  isAdminRole,
} from '../../utils/roles';

function getProfilePath(role) {
  if (role === 'member') return '/member/profile';
  if (role === 'formateur') return '/trainer/profile';
  if (isAdminRole(role)) return '/admin/profile-coworking';
  return '/super-admin/dashboard';
}

// Titres des pages hors navigation (breadcrumb / recherche)
const PAGE_TITLES = {
  '/book/step1': 'Réserver un espace',
  '/book/step2': 'Réserver un espace',
  '/book/step3': 'Réserver un espace',
  '/admin/profile-coworking': 'Profil du Coworking',
  '/admin/formations': 'Formations',
  '/admin/formateurs': 'Formateurs',
  '/admin/onboarding': 'Configuration initiale',
  '/trainer-dashboard': 'Tableau de bord',
  '/member/profile': 'Mon Profil',
  '/trainer/profile': 'Mon Profil',
  '/dashboard/notifications': 'Notifications',
};

function derivePageTitle(pathname, navItems) {
  const match = navItems.find((item) =>
    pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  if (match) return match.label;
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const last = pathname.split('/').filter(Boolean).pop();
  if (!last) return 'Tableau de bord';
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getNotifIcon(type) {
  if (type === 'confirmation_reservation' || type === 'reservation') return 'calendar_month';
  if (type === 'payment' || type === 'facture') return 'receipt_long';
  if (type === 'formation') return 'school';
  return 'notifications';
}

/* === NavLink Sidebar === */
function NavLink({ item, isActive, onClick, dark }) {
  const itemColor = isActive ? '#f95d00' : (dark ? '#fbffff' : '#100f0d');
  const translatedLabel = item.label;

  return (
    <Link
      to={item.to}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: 'none',
        transition: 'all 0.15s ease',
        background: isActive
          ? (dark ? 'rgba(249,93,0,0.18)' : 'rgba(249,93,0,0.10)')
          : 'transparent',
        color: itemColor,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = dark ? 'rgba(249,93,0,0.10)' : 'rgba(249,93,0,0.06)';
          e.currentTarget.style.color = '#f95d00';
          const span = e.currentTarget.querySelector('span');
          if (span) span.style.color = '#f95d00';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = itemColor;
          const span = e.currentTarget.querySelector('span');
          if (span) span.style.color = itemColor;
        }
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 20, flexShrink: 0,
          fontVariationSettings: isActive
            ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
          color: itemColor,
        }}
      >
        {item.icon}
      </span>
      <span style={{ flex: 1, color: itemColor }}>{translatedLabel}</span>
      {isActive && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f95d00', flexShrink: 0 }} />
      )}
    </Link>
  );
}

export default function PortalLayout({ children, profile, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tenantLogo, setTenantLogo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const { dark, toggle } = useTheme();

  const initials = `${profile?.prenom?.[0] || ''}${profile?.nom?.[0] || ''}`.toUpperCase() || 'U';

  // Chargement du logo tenant fallback
  useEffect(() => {
    async function loadTenantLogo() {
      if (profile?.tenant_id && !profile?.photo_url && !profile?.avatar_url) {
        try {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('logo_url')
            .eq('id', profile.tenant_id)
            .single();
          if (tenantData?.logo_url) {
            setTenantLogo(tenantData.logo_url);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    loadTenantLogo();
  }, [profile]);

  // Chargement + Écoute Temps Réel des Notifications
  useEffect(() => {
    if (!profile?.id) return;

    async function fetchNotifications() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(15);

        if (!error && data) {
          setNotifications(data);
          const unread = data.filter(n => !n.lu).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        console.error('Erreur chargement notifications:', err);
      }
    }

    fetchNotifications();

    const channel = supabase
      .channel(`user-notifs-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const avatarUrl = profile?.photo_url || profile?.avatar_url || profile?.avatar || profile?.tenant?.logo_url || tenantLogo || null;

  const isSuperAdmin = profile?.role === 'super_admin';
  const isStaff = profile?.role === 'staff';
  const adminView = isAdminRole(profile?.role);
  const isTrainer = profile?.role === 'formateur';
  const navSections = isSuperAdmin
    ? SUPER_ADMIN_NAV
    : isStaff
      ? STAFF_NAV
      : adminView
        ? ADMIN_NAV
        : isTrainer
          ? FORMATEUR_NAV
          : MEMBER_NAV;
  const navItems = flattenNav(navSections);
  const homePath = getHomePath(profile?.role);
  const profilePath = getProfilePath(profile?.role);
  const portalLabel = isSuperAdmin
    ? 'VCLOW Platform'
    : isStaff
      ? 'Réception'
      : adminView
        ? 'Administration'
        : isTrainer
          ? 'Espace Formateur'
          : 'Espace membre';
  const pageTitle = derivePageTitle(location.pathname, navItems);

  // Recherche contextuelle : filtre le menu du rôle courant
  const searchResults = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ).slice(0, 8)
    : [];

  const goToSearchResult = (item) => {
    setSearchQuery('');
    navigate(item.to);
  };

  const isNavActive = (to) => {
    if (to === homePath) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const markAsRead = async (id) => {
    try {
      await supabase.from('notifications').update({ lu: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.lu) {
      await markAsRead(n.id);
    }
    setNotifOpen(false);

    const type = n.type || '';
    const isAdmin = ['super_admin', 'admin', 'staff'].includes(profile?.role);
    const isTrainer = profile?.role === 'formateur';

    let targetUrl = '';
    if (type.includes('reservation') || type.includes('session') || type === 'nouvelle_demande_reservation') {
      targetUrl = isAdmin ? '/admin/reservations' : '/dashboard/bookings';
    } else if (type.includes('paiement') || type.includes('payment') || type.includes('facture')) {
      targetUrl = isAdmin ? '/admin/payments' : '/dashboard/payments';
    } else if (type.includes('message')) {
      targetUrl = isAdmin ? '/admin/messages' : (isTrainer ? '/trainer/messages' : '/dashboard/messages');
    } else if (type.includes('formation') || type.includes('inscription')) {
      targetUrl = isTrainer ? '/trainer/formations' : (isAdmin ? '/admin/formations' : '/dashboard/formations');
    } else if (type.includes('abonnement')) {
      targetUrl = '/dashboard/subscription';
    } else {
      targetUrl = isAdmin ? '/admin/reservations' : '/dashboard/bookings';
    }

    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase.from('notifications').update({ lu: true }).eq('user_id', profile.id).eq('lu', false);
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: dark ? '#100f0d' : '#f6f4f1',
      color: dark ? '#fbffff' : '#100f0d',
      transition: 'background 0.3s ease, color 0.3s ease',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: 384, height: 384, borderRadius: '50%', pointerEvents: 'none', zIndex: -1, background: 'radial-gradient(circle, rgba(249,93,0,0.05), transparent)', transform: 'translate(30%, -30%)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 384, height: 384, borderRadius: '50%', pointerEvents: 'none', zIndex: -1, background: 'radial-gradient(circle, rgba(16,15,13,0.05), transparent)', transform: 'translate(-30%, 30%)' }} />

      {/* === HEADER === */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 68, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: dark ? 'rgba(16,15,13,0.92)' : 'rgba(251,255,255,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(16,15,13,0.08)',
        boxShadow: '0 2px 12px rgba(16,15,13,0.05)',
        transition: 'background 0.3s ease',
      }}>
        {/* Left: Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandLogo to={homePath} height={44} />
        </div>

        {/* Search — Barre de recherche contextuelle (menu du rôle) · Spec §13 */}
        <div ref={searchRef} style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 340, position: 'relative', marginLeft: 24 }}>
          <div style={{ position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 18, color: dark ? 'rgba(251,255,255,0.5)' : '#8a8f98', pointerEvents: 'none',
              }}
            >
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) goToSearchResult(searchResults[0]);
              }}
              placeholder="Rechercher dans le menu…"
              aria-label="Recherche contextuelle"
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(16,15,13,0.10)',
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(16,15,13,0.04)',
                color: dark ? '#fbffff' : '#100f0d',
                fontSize: 13.5,
                padding: '0 12px 0 38px',
                outline: 'none',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#f95d00'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(16,15,13,0.10)'; }}
            />
          </div>

          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 46, left: 0, right: 0,
              background: dark ? '#1b1a18' : '#ffffff',
              border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(16,15,13,0.08)',
              borderRadius: 16,
              boxShadow: dark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 16px 40px rgba(16,15,13,0.15)',
              zIndex: 120, overflow: 'hidden', padding: 6,
              animation: 'popDropdown 0.2s ease-out both',
            }}>
              {searchResults.map((item) => (
                <button
                  key={item.to}
                  onClick={() => goToSearchResult(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 12px', borderRadius: 12,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13.5, fontWeight: 600,
                    color: dark ? '#fbffff' : '#100f0d',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(249,93,0,0.15)' : 'rgba(249,93,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f95d00' }}>{item.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim() && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: 46, left: 0, right: 0,
              background: dark ? '#1b1a18' : '#ffffff',
              border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(16,15,13,0.08)',
              borderRadius: 16,
              boxShadow: dark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 16px 40px rgba(16,15,13,0.15)',
              zIndex: 120, padding: '16px 18px',
              fontSize: 13, color: dark ? 'rgba(251,255,255,0.6)' : '#666',
            }}>
              Aucun résultat dans le menu.
            </div>
          )}
        </div>

        {/* Right: User profile + Language Switcher + Notification Bell + Dark toggle + Clickable Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>

          {/* Nom et rôle */}
          <div
            className="hidden sm:flex"
            onClick={() => { setDropdownOpen(v => !v); setNotifOpen(false); }}
            style={{ flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: dark ? '#fbffff' : '#100f0d', lineHeight: 1.2 }}>
              {profile?.prenom} {profile?.nom}
            </span>
            <span style={{ fontSize: 12, color: dark ? 'rgba(251,255,255,0.6)' : '#44474d', marginTop: 2 }}>
              {getRoleLabel(profile?.role)}
            </span>
          </div>

          {/* 🛎️ BOUTON NOTIFICATION AVEC COMPTEUR TEMPS RÉEL */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(v => !v); setDropdownOpen(false); }}
              title="Notifications"
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 12, border: 'none',
                cursor: 'pointer', transition: 'all 0.2s ease',
                background: notifOpen
                  ? (dark ? 'rgba(249,93,0,0.25)' : 'rgba(249,93,0,0.15)')
                  : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,15,13,0.06)'),
                color: notifOpen ? '#f95d00' : (dark ? '#fbffff' : '#100f0d'),
                boxShadow: dark ? 'inset 0 1px 2px rgba(255,255,255,0.1)' : 'inset 0 1px 2px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => {
                if (!notifOpen) {
                  e.currentTarget.style.background = dark ? 'rgba(249,93,0,0.2)' : 'rgba(249,93,0,0.12)';
                  e.currentTarget.style.color = '#f95d00';
                }
              }}
              onMouseLeave={e => {
                if (!notifOpen) {
                  e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,15,13,0.06)';
                  e.currentTarget.style.color = dark ? '#fbffff' : '#100f0d';
                }
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>

              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  minWidth: 18, height: 18, padding: '0 4px',
                  borderRadius: 99, background: '#f95d00', color: '#ffffff',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(249,93,0,0.5)',
                  border: dark ? '2px solid #100f0d' : '2px solid #ffffff',
                  animation: 'pulseNotif 2s infinite',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* POP-UP NOTIFICATIONS */}
            {notifOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 52, right: 0,
                  width: 360, maxWidth: '90vw',
                  background: dark ? '#1b1a18' : '#ffffff',
                  color: dark ? '#fbffff' : '#100f0d',
                  borderRadius: 20,
                  border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(16,15,13,0.08)',
                  boxShadow: dark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 16px 40px rgba(16,15,13,0.15)',
                  zIndex: 100, overflow: 'hidden',
                  animation: 'popDropdown 0.2s ease-out both',
                }}
              >
                <style>{"@keyframes popDropdown { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }"}</style>

                <div style={{
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,15,13,0.08)',
                  background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(16,15,13,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(249,93,0,0.12)', color: '#f95d00' }}>
                        {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ fontSize: 12, fontWeight: 600, color: '#f95d00', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      Tout lire
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', color: dark ? 'rgba(251,255,255,0.5)' : '#666' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.4, marginBottom: 8, display: 'block' }}>notifications_off</span>
                      <p style={{ fontSize: 13, margin: 0 }}>Aucune notification pour le moment.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          padding: '14px 18px',
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          cursor: 'pointer', transition: 'background 0.15s ease',
                          background: n.lu
                            ? 'transparent'
                            : (dark ? 'rgba(249,93,0,0.08)' : 'rgba(249,93,0,0.04)'),
                          borderBottom: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(16,15,13,0.04)',
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          background: n.lu
                            ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(16,15,13,0.05)')
                            : 'rgba(249,93,0,0.12)',
                          color: n.lu ? (dark ? 'rgba(251,255,255,0.6)' : '#666') : '#f95d00',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{getNotifIcon(n.type)}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: n.lu ? 500 : 700, margin: 0, lineHeight: 1.35, color: dark ? '#fbffff' : '#100f0d' }}>
                            {n.message || n.title || 'Notification'}
                          </p>
                          <span style={{ fontSize: 11, color: dark ? 'rgba(251,255,255,0.5)' : '#888', marginTop: 4, display: 'block' }}>
                            {getRelativeTime(n.created_at)}
                          </span>
                        </div>
                        {!n.lu && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f95d00', flexShrink: 0, marginTop: 4 }} />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div style={{
                  padding: '12px 20px', textAlign: 'center',
                  borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,15,13,0.08)',
                  background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(16,15,13,0.02)',
                }}>
                  <Link
                    to="/dashboard/notifications"
                    onClick={() => setNotifOpen(false)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#f95d00', textDecoration: 'none' }}
                  >
                    Voir le centre de notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Bouton Toggle Mode Sombre / Clair ajusté */}
          <button
            onClick={toggle}
            title={dark ? 'Mode clair' : 'Mode sombre'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 12, border: 'none',
              cursor: 'pointer', transition: 'all 0.2s ease',
              background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,15,13,0.06)',
              color: dark ? '#ffd966' : '#100f0d',
              boxShadow: dark ? 'inset 0 1px 2px rgba(255,255,255,0.1)' : 'inset 0 1px 2px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = dark ? 'rgba(249,93,0,0.2)' : 'rgba(249,93,0,0.12)';
              e.currentTarget.style.color = '#f95d00';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,15,13,0.06)';
              e.currentTarget.style.color = dark ? '#ffd966' : '#100f0d';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
              {dark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Cercle Photo / Logo cliquable */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => { setDropdownOpen(v => !v); setNotifOpen(false); }}
              title="Menu profil"
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: '50%',
                flexShrink: 0, border: '2px solid #ffffff',
                boxShadow: dropdownOpen ? '0 0 0 3px #f95d00' : '0 2px 10px rgba(16,15,13,0.15)',
                background: avatarUrl ? '#ffffff' : 'linear-gradient(135deg, #100f0d, #f95d00)',
                color: '#fbffff', cursor: 'pointer', overflow: 'hidden',
                transition: 'all 0.2s ease', padding: 0,
                fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14,
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${profile?.prenom || ''} ${profile?.nom || ''}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>

            {/* === MENU DÉROULANT DU PROFIL === */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 52, right: 0,
                  width: 260,
                  background: dark ? '#1b1a18' : '#ffffff',
                  color: dark ? '#fbffff' : '#100f0d',
                  borderRadius: 20,
                  border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(16,15,13,0.08)',
                  boxShadow: dark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 16px 40px rgba(16,15,13,0.15)',
                  padding: '16px',
                  zIndex: 100,
                  animation: 'popDropdown 0.2s ease-out both',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, marginBottom: 12, borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,15,13,0.08)' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 15,
                    background: avatarUrl ? '#ffffff' : 'linear-gradient(135deg, #100f0d, #f95d00)', color: '#fbffff',
                    overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(249,93,0,0.2)',
                  }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whitespace: 'nowrap' }}>
                      {profile?.prenom} {profile?.nom}
                    </p>
                    <p style={{ fontSize: 11, color: dark ? 'rgba(251,255,255,0.6)' : '#666', margin: '2px 0 4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whitespace: 'nowrap' }}>
                      {profile?.email || ''}
                    </p>
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(249,93,0,0.12)', color: '#f95d00',
                    }}>
                      {getRoleLabel(profile?.role)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Link
                    to={profilePath}
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      fontSize: 13, fontWeight: 600,
                      textDecoration: 'none',
                      color: dark ? '#fbffff' : '#100f0d',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,15,13,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f95d00' }}>account_circle</span>
                    <span>Mon Profil</span>
                  </Link>

                  <div style={{ margin: '6px 0', borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,15,13,0.08)' }} />

                  <button
                    onClick={() => { setDropdownOpen(false); onLogout(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      fontSize: 13, fontWeight: 600,
                      border: 'none', background: 'transparent',
                      color: '#ba1a1a', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(186,26,26,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ba1a1a' }}>logout</span>
                    <span>Déconnexion</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>
      </header>

      <div style={{ display: 'flex', paddingTop: 68 }}>

        {/* Sidebar */}
        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          width: 240,
          minHeight: 'calc(100vh - 68px)',
          position: 'sticky',
          top: 68,
          alignSelf: 'flex-start',
          background: dark ? 'rgba(17,16,14,0.97)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRight: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(16,15,13,0.08)',
          padding: '24px 12px',
          transition: 'background 0.3s ease',
        }}>
          {/* Label section */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '0 12px', marginBottom: 12, color: dark ? 'rgba(251,255,255,0.5)' : '#44474d' }}>
            {portalLabel}
          </p>

          {/* Navigation links — Menu / Sous-menu (Spec §13) */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {navSections.map((section, idx) => (
              <div key={section.group || idx}>
                <p style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em',
                  color: dark ? 'rgba(251,255,255,0.45)' : '#6b7280',
                  margin: '0 0 6px 12px',
                }}>
                  {section.group}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(section.items || []).map((item) => (
                    <NavLink key={item.id} item={item} isActive={isNavActive(item.to)} dark={dark} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Logout button at bottom of sidebar */}
          <div style={{
            marginTop: 'auto',
            paddingTop: 20,
            borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16,15,13,0.08)',
          }}>
            <button
              onClick={onLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                border: '1px solid rgba(186,26,26,0.2)',
                background: 'rgba(186,26,26,0.05)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                color: '#ba1a1a',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ba1a1a';
                e.currentTarget.style.color = '#ffffff';
                const spans = e.currentTarget.querySelectorAll('span');
                spans.forEach(s => s.style.color = '#ffffff');
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(186,26,26,0.05)';
                e.currentTarget.style.color = '#ba1a1a';
                const spans = e.currentTarget.querySelectorAll('span');
                spans.forEach(s => s.style.color = '#ba1a1a');
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, flexShrink: 0, color: '#ba1a1a' }}>logout</span>
              <span style={{ color: '#ba1a1a' }}>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1, overflowX: 'hidden',
          padding: '28px 24px', minHeight: 'calc(100vh - 68px)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Breadcrumb — Fil d'ariane (Spec §13) */}
            <nav aria-label="Fil d'ariane" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 500,
              color: dark ? 'rgba(251,255,255,0.55)' : '#6b7280',
              margin: '-10px 0 18px',
              flexWrap: 'wrap',
            }}>
              <Link to={homePath} style={{ color: '#f95d00', textDecoration: 'none', fontWeight: 600 }}>
                {portalLabel}
              </Link>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              <span style={{ color: dark ? '#fbffff' : '#100f0d', fontWeight: 700 }}>{pageTitle}</span>
            </nav>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
