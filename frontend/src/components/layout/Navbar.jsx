import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

/**
 * Navbar principale — DeskyWork
 * Utilisable sur toutes les pages publiques.
 * Props:
 *   session        — objet session Supabase (ou null)
 *   activeLink     — href du lien actif (ex: '#espaces')
 *   transparent    — si true, fond transparent jusqu'au scroll
 */
export default function Navbar({ session, activeLink = '', transparent = false }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
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
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 2px 20px rgba(0,13,35,.08);
          border-bottom: 1px solid rgba(0,13,35,.06);
        }
        .ec-navbar.transparent-nav {
          background: transparent;
        }
        .ec-navbar .brand-logo-img {
          height: 60px;
          width: auto;
          max-height: 60px;
          object-fit: contain;
          transform: scale(2.4);
          transform-origin: left center;
          transition: transform .2s ease, opacity .2s ease;
          display: block;
          flex-shrink: 0;
        }
        .ec-navbar .brand-logo-img:hover { transform: scale(2.52); }
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
        .ec-navbar .nav-link-item.active {
          color: #f95d00;
        }
        .ec-navbar .nav-link-item:hover::after,
        .ec-navbar .nav-link-item.active::after {
          width: 100%;
        }
        .ec-navbar .btn-login {
          background: transparent;
          color: #100f0d;
          border: 1.5px solid #100f0d;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .ec-navbar .btn-login:hover {
          background: #100f0d;
          color: #fbffff;
        }
        .ec-navbar .btn-cta {
          background: #f95d00;
          color: #fbffff;
          border: none;
          border-radius: 10px;
          padding: 9px 20px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .ec-navbar .btn-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(249,93,0,.35);
        }
        .ec-navbar .btn-portal {
          background: transparent;
          color: #f95d00;
          border: 1.5px solid #f95d00;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
          text-decoration: none;
          white-space: nowrap;
        }
        .ec-navbar .btn-portal:hover {
          background: #f95d00;
          color: #fbffff;
        }
        .ec-navbar .btn-logout {
          background: transparent;
          color: #ba1a1a;
          border: 1.5px solid #ba1a1a;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .22s;
        }
        .ec-navbar .btn-logout:hover {
          background: #ba1a1a;
          color: white;
        }
        .ec-navbar .menu-toggle {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #000d23;
          display: flex; align-items: center;
        }
        /* Mobile menu */
        .ec-mobile-menu {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 12px 0 20px;
          border-top: 1px solid rgba(0,13,35,.07);
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(16px);
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
          transition: color .2s;
        }
        .ec-mobile-menu .mob-link:hover { color: #f95d00; }
        .ec-mobile-menu .mob-actions {
          display: flex;
          gap: 10px;
          padding-top: 12px;
        }
        .ec-mobile-menu .mob-actions a,
        .ec-mobile-menu .mob-actions button {
          flex: 1;
          text-align: center;
        }

        @media (max-width: 991px) {
          .ec-navbar .desktop-nav { display: none !important; }
        }
        @media (min-width: 992px) {
          .ec-navbar .menu-toggle { display: none !important; }
          .ec-mobile-menu { display: none !important; }
        }
      `}</style>

      <nav className={`ec-navbar ${isScrolledOrSolid ? 'solid' : 'transparent-nav'}`}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          {/* ── Main bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', height: 76, gap: 32 }}>

            {/* Brand — DeskyWork */}
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <img
                src="/logo 1.png"
                alt="DeskyWork"
                className="brand-logo-img"
              />
            </Link>

            {/* Desktop links */}
            <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 1, justifyContent: 'center' }}>
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
            <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {session ? (
                <>
                  <Link to="/dashboard" className="btn-portal">
                    <span className="material-symbols-outlined align-middle" style={{ fontSize: 16, marginRight: 4 }}>dashboard</span>
                    Mon Portail
                  </Link>
                  <button onClick={handleLogout} className="btn-logout">
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-login">
                    Connexion
                  </Link>
                  <Link to="/register" className="btn-cta">
                    Devenir Membre
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="menu-toggle ms-auto" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                {menuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>

          {/* ── Mobile menu ── */}
          <div className={`ec-mobile-menu ${menuOpen ? 'open' : ''}`}>
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} className="mob-link" onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
            <div className="mob-actions">
              {session ? (
                <>
                  <Link to="/dashboard" className="btn-portal" style={{ display: 'block', textAlign: 'center' }}>Mon Portail</Link>
                  <button onClick={handleLogout} className="btn-logout">Déconnexion</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-login" style={{ display: 'block', textAlign: 'center' }}>Connexion</Link>
                  <Link to="/register" className="btn-cta" style={{ display: 'block', textAlign: 'center' }}>Devenir Membre</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
