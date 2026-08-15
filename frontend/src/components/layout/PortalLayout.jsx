import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useTheme } from '../../context/ThemeContext';
import {
  ADMIN_NAV,
  STAFF_NAV,
  MEMBER_NAV,
  FORMATEUR_NAV,
  SUPER_ADMIN_NAV,
  getHomePath,
  getRoleLabel,
  isAdminRole,
} from '../../utils/roles';

/* ─── Lien de navigation sidebar ─── */
function NavLink({ item, isActive, onClick }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${isActive
          ? 'bg-primary-container text-on-primary-container shadow-sm'
          : 'text-on-surface-variant hover:bg-secondary/7 hover:text-secondary'
        }`}
    >
      <span
        className="material-symbols-outlined shrink-0"
        style={{
          fontSize: 20,
          fontVariationSettings: isActive
            ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        }}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
      )}
    </Link>
  );
}

/* ─── Lien bottom nav mobile ─── */
function BottomNavLink({ item, isActive }) {
  return (
    <Link
      to={item.to}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 flex-1 transition-colors duration-150 ${isActive ? 'text-secondary' : 'text-on-surface-variant'
        }`}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 22,
          fontVariationSettings: isActive
            ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        }}
      >
        {item.icon}
      </span>
      <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
    </Link>
  );
}

export default function PortalLayout({ children, profile, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dark, toggle } = useTheme();

  const initials = `${profile?.prenom?.[0] || ''}${profile?.nom?.[0] || ''}`.toUpperCase() || 'U';
  const isSuperAdmin = profile?.role === 'super_admin';
  const isStaff = profile?.role === 'staff';
  const adminView = isAdminRole(profile?.role);
  const isTrainer = profile?.role === 'formateur';
  const navItems = isSuperAdmin
    ? SUPER_ADMIN_NAV
    : isStaff
      ? STAFF_NAV
      : adminView
        ? ADMIN_NAV
        : isTrainer
          ? FORMATEUR_NAV
          : MEMBER_NAV;
  const homePath = getHomePath(profile?.role);
  const portalLabel = isSuperAdmin
    ? 'VCLOW Platform'
    : isStaff
      ? 'Réception'
      : adminView
        ? 'Administration'
        : isTrainer
          ? 'Espace Formateur'
          : 'Espace membre';

  const isNavActive = (to) => {
    if (to === homePath) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  /* Bottom nav : max 5 items sur mobile */
  const bottomNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen text-on-surface" style={{ background: dark ? 'var(--color-background)' : '#f4f6f9', transition: 'background 0.3s ease' }}>

      {/* ── Blobs décoratifs ambient ── */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, rgba(0,84,203,0.04), transparent)', transform: 'translate(30%, -30%)' }} />
      <div className="fixed bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, rgba(0,13,35,0.04), transparent)', transform: 'translate(-30%, 30%)' }} />

      {/* ══════════════════════════════════════════
          HEADER fixe
          ══════════════════════════════════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
        style={{
          height: 64,
          padding: '0 24px',
          background: dark
            ? 'rgba(17,19,24,0.92)'
            : 'rgba(251,249,251,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: dark
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid rgba(197,198,206,0.25)',
          boxShadow: '0 2px 12px rgba(0,13,35,0.05)',
          transition: 'background 0.3s ease',
        }}
      >
        {/* Gauche : hamburger mobile + logo */}
        <div className="flex items-center gap-3">
          {/* Bouton hamburger visible uniquement sur mobile */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Ouvrir le menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {sidebarOpen ? 'close' : 'menu'}
            </span>
          </button>
          <BrandLogo to={homePath} />
        </div>

        {/* Droite : infos utilisateur + déconnexion */}
        <div className="flex items-center gap-3">
          {/* Nom et rôle — masqués sur très petit écran */}
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-sm font-semibold text-primary">
              {profile?.prenom} {profile?.nom}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5">
              {getRoleLabel(profile?.role)}
            </span>
          </div>

          {/* ── Bouton Dark / Light mode ── */}
          <button
            onClick={toggle}
            title={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,13,35,0.07)',
              color: dark ? '#ffd966' : '#44474d',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
              {dark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Avatar initiales */}
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full font-sora font-bold text-sm shrink-0 border-2 border-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #10233f, #0054cb)', color: '#dae2ff' }}
          >
            {initials}
          </div>

        </div>
      </header>

      {/* ══════════════════════════════════════════
          OVERLAY mobile sidebar
          ══════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════
          LAYOUT principal (sidebar + contenu)
          ══════════════════════════════════════════ */}
      <div className="flex" style={{ paddingTop: 64 }}>

        {/* ── SIDEBAR desktop (toujours visible ≥ md) ── */}
        <aside
          className="hidden md:flex flex-col shrink-0"
          style={{
            width: 240,
            minHeight: 'calc(100vh - 64px)',
            position: 'sticky',
            top: 64,
            alignSelf: 'flex-start',
            background: dark ? 'rgba(25,28,33,0.95)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
            borderRight: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(197,198,206,0.2)',
            padding: '24px 12px',
            gap: 0,
            transition: 'background 0.3s ease',
          }}
        >
          {/* Label section */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant px-3 mb-3">
            {portalLabel}
          </p>

          {/* Nav items */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                isActive={isNavActive(item.to)}
              />
            ))}
          </nav>

          {/* Séparateur + déconnexion bas sidebar */}
          <div className="mt-auto pt-6 border-t border-outline-variant/20">
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-error hover:bg-error/8 transition-all w-full"
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>logout</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* ── SIDEBAR mobile (drawer) ── */}
        <aside
          className={`fixed top-[64px] left-0 bottom-0 z-40 md:hidden flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          style={{
            width: 256,
            background: dark ? 'rgba(17,19,24,0.98)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            borderRight: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(197,198,206,0.3)',
            padding: '20px 12px',
            overflowY: 'auto',
            transition: 'background 0.3s ease',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant px-3 mb-3">
            {portalLabel}
          </p>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                isActive={isNavActive(item.to)}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
          <div className="mt-auto pt-6 border-t border-outline-variant/20">
            <button
              onClick={() => { setSidebarOpen(false); onLogout(); }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-error hover:bg-error/8 transition-all w-full"
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>logout</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* ── CONTENU principal ── */}
        <main
          className="flex-1 overflow-x-hidden"
          style={{
            padding: '28px 24px',
            minHeight: 'calc(100vh - 64px)',
            /* Offset bas sur mobile pour bottom nav */
            paddingBottom: 'max(28px, calc(72px + 8px))',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════
          BOTTOM NAV — visible uniquement mobile (< md)
          ══════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          height: 64,
          background: dark
            ? 'rgba(17,19,24,0.97)'
            : 'rgba(251,249,251,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: dark
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid rgba(197,198,206,0.3)',
          boxShadow: '0 -4px 20px rgba(0,13,35,0.07)',
          transition: 'background 0.3s ease',
        }}
      >
        {bottomNavItems.map((item) => (
          <BottomNavLink
            key={item.id}
            item={item}
            isActive={isNavActive(item.to)}
          />
        ))}
      </nav>
    </div>
  );
}
