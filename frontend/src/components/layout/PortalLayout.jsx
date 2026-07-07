import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const S1_NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', to: '/dashboard', active: true },
];

const LATER_NAV = [
  { label: 'Réservations', icon: 'calendar_today', note: 'S2' },
  { label: 'Abonnement', icon: 'payments', note: 'S2' },
  { label: 'Factures', icon: 'receipt_long', note: 'Dev 2' },
];

export default function PortalLayout({ children, profile, onLogout }) {
  const initials = `${profile?.prenom?.[0] || ''}${profile?.nom?.[0] || ''}`.toUpperCase() || 'M';

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-on-surface">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20">
        <BrandLogo to="/dashboard" />
        <div className="flex items-center gap-sm">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-label-sm font-semibold text-primary capitalize">
              {profile?.prenom} {profile?.nom}
            </span>
            <span className="text-label-sm text-on-surface-variant capitalize">{profile?.role}</span>
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
          <nav className="flex flex-col gap-xs flex-grow">
            {S1_NAV.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="flex items-center gap-sm px-4 py-3 bg-primary-container text-on-primary-container rounded-lg font-semibold"
              >
                <span className="material-symbols-outlined filled text-[20px]">{item.icon}</span>
                <span className="text-label-md">{item.label}</span>
              </Link>
            ))}

            <div className="mt-md pt-md border-t border-outline-variant/30">
              <p className="px-4 mb-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
                Bientôt disponible
              </p>
              {LATER_NAV.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-sm px-4 py-3 text-on-surface-variant/50 rounded-lg cursor-not-allowed"
                  title={`Prévu : ${item.note}`}
                >
                  <span className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="text-label-md">{item.label}</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-surface-container-high px-1.5 py-0.5 rounded">
                    {item.note}
                  </span>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <main className="flex-grow overflow-y-auto px-margin-mobile md:px-margin-desktop py-lg">
          <div className="max-w-container-max mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
