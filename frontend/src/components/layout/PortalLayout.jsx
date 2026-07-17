import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import {
  ADMIN_NAV,
  MEMBER_NAV,
  getHomePath,
  getRoleLabel,
  isAdminRole,
} from '../../utils/roles';

function NavLink({ item, isActive }) {
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-sm px-4 py-3 rounded-lg font-semibold transition-colors ${
        isActive
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface hover:bg-primary/10'
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${isActive ? 'filled' : ''}`}>
        {item.icon}
      </span>
      <span className="text-label-md">{item.label}</span>
    </Link>
  );
}

export default function PortalLayout({ children, profile, onLogout }) {
  const location = useLocation();
  const initials = `${profile?.prenom?.[0] || ''}${profile?.nom?.[0] || ''}`.toUpperCase() || 'U';
  const adminView = isAdminRole(profile?.role);
  const navItems = adminView ? ADMIN_NAV : MEMBER_NAV;
  const homePath = getHomePath(profile?.role);
  const portalLabel = adminView ? 'Administration' : 'Espace membre';

  const isNavActive = (to) => {
    if (to === homePath) {
      return location.pathname === to;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-on-surface">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20">
        <BrandLogo to={homePath} />
        <div className="flex items-center gap-sm">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-label-sm font-semibold text-primary capitalize">
              {profile?.prenom} {profile?.nom}
            </span>
            <span className="text-label-sm text-on-surface-variant">
              {getRoleLabel(profile?.role)}
            </span>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold border-2 border-white shadow-sm">
            {initials}
          </div>
          <button
            onClick={onLogout}
            className="px-sm py-2 text-label-md font-semibold text-on-surface-variant hover:text-secondary transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex pt-[72px] min-h-screen">
        <aside className="hidden md:flex flex-col w-64 bg-surface-container-lowest border-r border-outline-variant/30 p-lg gap-sm shrink-0">
          <p className="px-4 mb-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
            {portalLabel}
          </p>
          <nav className="flex flex-col gap-xs flex-grow">
            {navItems.map((item) => (
              <NavLink key={item.id} item={item} isActive={isNavActive(item.to)} />
            ))}
          </nav>
        </aside>

        <main className="flex-grow overflow-y-auto px-margin-mobile md:px-margin-desktop py-lg">
          <div className="max-w-container-max mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
