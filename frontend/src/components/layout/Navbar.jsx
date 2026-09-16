import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../context/ThemeContext';

/**
 * Navbar principale — DeskyWork
 * Props:
 *   session    — objet session Supabase (ou null)
 *   activeLink — href du lien actif (ex: '#espaces')
 *   transparent — si true, fond transparent jusqu'au scroll
 */
export default function Navbar({ session, activeLink = '', transparent = false }) {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 992) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navLinks = [
    { href: '#avantages', label: 'Avantages' },
    { href: '#espaces', label: 'Espaces' },
    { href: '#tarifs', label: 'Tarifs' },
    { href: '#temoignages', label: 'Témoignages' },
    { href: '#contact', label: 'Contact' },
  ];

  const isScrolledOrSolid = scrolled || !transparent;
  const logoSrc = dark ? '/logo 2.png' : '/logo 1.png';

  return (
    <>
      <style>{`
        .ec-navbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          transition: background .3s ease, box-shadow .3s ease, backdrop-filter .3s;
        }
        .ec-navbar.solid {
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 2px 20px rgba(0,13,35,.08);
          border-bottom: 1px solid rgba(0,13,35,.06);
        }
        .dark .ec-navbar.solid {
          background: rgba(16,15,13,0.96);
          box-shadow: 0 4px 24px rgba(0,0,0,.5);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ec-navbar.transparent-nav {
          background: transparent;
        }

        /* ── Logo responsive ── */
        .ec-navbar .brand-logo-img {
          height: 44px;
          width: auto;
          object-fit: contain;
          transform: scale(1.9);
          transform-origin: left center;
          transition: transform .2s ease;
          display: block;
          flex-shrink: 0;
        }
        .ec-navbar .brand-logo-img:hover { transform: scale(2.0); }

        @media (max-width: 991px) {
          .ec-navbar .brand-logo-img {
            height: 34px;
            transform: scale(1.5);
          }
          .ec-navbar .brand-logo-img:hover { transform: scale(1.58); }
        }
        @media (max-width: 479px) {
          .ec-navbar .brand-logo-img {
            height: 30px;
            transform: scale(1.35);
          }
          .ec-navbar .brand-logo-img:hover { transform: scale(1.42); }
        }

        /* ── Nav bar inner wrapper ── */
        .ec-navbar .nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
        }
        @media (max-width: 479px) {
          .ec-navbar .nav-inner {
            padding: 0 14px;
          }
        }

        /* ── Main bar ── */
        .ec-navbar .nav-bar {
          display: flex;
          align-items: center;
          height: 72px;
          gap: 24px;
        }
        @media (max-width: 991px) {
          .ec-navbar .nav-bar { height: 60px; gap: 12px; }
        }
        @media (max-width: 479px) {
          .ec-navbar .nav-bar { height: 56px; gap: 8px; }
        }

        /* ── Desktop nav links ── */
        .ec-navbar .desktop-nav {
          display: flex;
          align-items: center;
          gap: 28px;
          flex: 1;
          justify-content: center;
        }
        .ec-navbar .desktop-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        @media (max-width: 991px) {
          .ec-navbar .desktop-nav,
          .ec-navbar .desktop-actions { display: none !important; }
        }

        /* ── Mobile right-side controls ── */
        .ec-navbar .mobile-controls {
          display: none;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }
        @media (max-width: 991px) {
          .ec-navbar .mobile-controls { display: flex; }
        }

        /* ── Link styles ── */
        .ec-navbar .nav-link-item {
          font-size: .92rem;
          font-weight: 500;
          color: #44474d;
          text-decoration: none;
          padding: 6px 4px;
          position: relative;
          transition: color .2s;
          white-space: nowrap;
        }
        .dark .ec-navbar .nav-link-item { color: #cfcac3; }
        .ec-navbar .nav-link-item::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0;
          width: 0; height: 2px;
          background: #f95d00;
          border-radius: 2px;
          transition: width .25s ease;
        }
        .ec-navbar .nav-link-item:hover,
        .ec-navbar .nav-link-item.active { color: #f95d00; }
        .dark .ec-navbar .nav-link-item:hover,
        .dark .ec-navbar .nav-link-item.active { color: #ff8a3d; }
        .ec-navbar .nav-link-item:hover::after,
        .ec-navbar .nav-link-item.active::after { width: 100%; }

        /* ── Buttons ── */
        .ec-navbar .btn-theme-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px; height: 36px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: rgba(16,15,13,0.06);
          color: #100f0d;
          flex-shrink: 0;
        }
        .dark .ec-navbar .btn-theme-toggle {
          background: rgba(255,255,255,0.08);
          color: #ffd966;
        }
        .ec-navbar .btn-theme-toggle:hover {
          background: rgba(249,93,0,0.15);
          color: #f95d00;
        }
        .ec-navbar .btn-login {
          background: transparent;
          color: #100f0d;
          border: 1.5px solid #100f0d;
          border-radius: 10px;
          padding: 7px 16px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .dark .ec-navbar .btn-login { color: #fbffff; border-color: rgba(255,255,255,0.3); }
        .ec-navbar .btn-login:hover {
          background: #f95d00;
          color: #ffffff !important;
          border-color: #f95d00;
        }
        .ec-navbar .btn-cta {
          background: #f95d00;
          color: #fbffff;
          border: none;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .ec-navbar .btn-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,93,0,.35); }
        .ec-navbar .btn-portal {
          background: transparent;
          color: #f95d00;
          border: 1.5px solid #f95d00;
          border-radius: 10px;
          padding: 7px 16px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .ec-navbar .btn-portal:hover { background: #f95d00; color: #fbffff; }
        .ec-navbar .btn-logout {
          background: transparent;
          color: #ba1a1a;
          border: 1.5px solid #ba1a1a;
          border-radius: 10px;
          padding: 7px 16px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
        }
        .ec-navbar .btn-logout:hover { background: #ba1a1a; color: white; }
        .ec-navbar .menu-toggle {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #100f0d;
          display: flex;
          align-items: center;
          border-radius: 8px;
          transition: background .2s;
        }
        .ec-navbar .menu-toggle:hover { background: rgba(16,15,13,0.06); }
        .dark .ec-navbar .menu-toggle { color: #fbffff; }
        .dark .ec-navbar .menu-toggle:hover { background: rgba(255,255,255,0.08); }

        /* ── Mobile menu dropdown ── */
        .ec-mobile-menu {
          display: none;
          flex-direction: column;
          gap: 2px;
          padding: 10px 0 16px;
          border-top: 1px solid rgba(0,13,35,.07);
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .dark .ec-mobile-menu {
          background: rgba(16,15,13,0.98);
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .ec-mobile-menu.open { display: flex; }

        .ec-mobile-menu .mob-link {
          display: block;
          padding: 10px 0;
          font-size: .95rem;
          font-weight: 500;
          color: #44474d;
          text-decoration: none;
          border-bottom: 1px solid rgba(0,13,35,.05);
          transition: color .2s, padding-left .2s;
        }
        .dark .ec-mobile-menu .mob-link { color: #cfcac3; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ec-mobile-menu .mob-link:hover { color: #f95d00; padding-left: 4px; }

        .ec-mobile-menu .mob-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 14px;
          align-items: stretch;
        }
        .ec-mobile-menu .mob-actions a,
        .ec-mobile-menu .mob-actions button.btn-action {
          flex: 1;
          min-width: 120px;
          text-align: center;
        }
      `}</style>

      <nav className={`ec-navbar ${isScrolledOrSolid ? 'solid' : 'transparent-nav'}`}>
        <div className="nav-inner">

          {/* ── Main bar ── */}
          <div className="nav-bar">

            {/* Brand */}
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <img src={logoSrc} alt="DeskyWork" className="brand-logo-img" />
            </Link>

            {/* Desktop nav links */}
            <div className="desktop-nav">
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className={`nav-link-item ${activeLink === href ? 'active' : ''}`}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Desktop actions */}
            <div className="desktop-actions">
              <button
                type="button"
                onClick={toggle}
                className="btn-theme-toggle"
                title={dark ? 'Passer au mode clair' : 'Passer au mode sombre'}
                aria-label="Basculer le thème"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                  {dark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              {session ? (
                <>
                  <Link to="/dashboard" className="btn-portal">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4, verticalAlign: 'middle' }}>dashboard</span>
                    Mon Portail
                  </Link>
                  <button onClick={handleLogout} className="btn-logout">Déconnexion</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-login">Connexion</Link>
                  <Link to="/register" className="btn-cta">Devenir Membre</Link>
                </>
              )}
            </div>

            {/* Mobile controls: theme toggle + hamburger */}
            <div className="mobile-controls">
              <button
                type="button"
                onClick={toggle}
                className="btn-theme-toggle"
                title={dark ? 'Mode clair' : 'Mode sombre'}
                aria-label="Basculer le thème"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19, fontVariationSettings: "'FILL' 1" }}>
                  {dark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              <button
                className="menu-toggle"
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={menuOpen}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  {menuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>

          {/* ── Mobile menu ── */}
          <div className={`ec-mobile-menu ${menuOpen ? 'open' : ''}`} role="navigation" aria-label="Menu mobile">
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} className="mob-link" onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <div className="mob-actions">
              {session ? (
                <>
                  <Link to="/dashboard" className="btn-portal" style={{ display: 'block', textAlign: 'center' }} onClick={() => setMenuOpen(false)}>
                    Mon Portail
                  </Link>
                  <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="btn-logout btn-action">
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-login" style={{ display: 'block', textAlign: 'center' }} onClick={() => setMenuOpen(false)}>
                    Connexion
                  </Link>
                  <Link to="/register" className="btn-cta" style={{ display: 'block', textAlign: 'center' }} onClick={() => setMenuOpen(false)}>
                    Devenir Membre
                  </Link>
                </>
              )}
            </div>
          </div>

        </div>
      </nav>
    </>
  );
}
