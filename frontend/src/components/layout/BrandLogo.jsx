import { Link } from 'react-router-dom';

/**
 * BrandLogo — Encre & Cobalt
 * Icône hub + nom + sous-titre "Coworking"
 * Props:
 *   to       — lien (défaut: '/')
 *   compact  — affiche uniquement l'icône
 *   light    — variante claire pour fonds sombres
 */
export default function BrandLogo({ to = '/', className = '', compact = false, light = false }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 group shrink-0 ${className}`} style={{ textDecoration: 'none' }}>
      {/* Icône carrée avec gradient primaire → secondaire */}
      <span
        className="flex items-center justify-center rounded-[11px] shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0"
        style={{
          width: 38,
          height: 38,
          background: 'linear-gradient(135deg, #000d23, #0054cb)',
        }}
      >
        <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 18 }}>
          hub
        </span>
      </span>

      {/* Nom + sous-titre */}
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className="font-sora font-bold tracking-tight"
            style={{
              fontSize: '1.05rem',
              lineHeight: '1.2',
              color: light ? '#ffffff' : '#000d23',
            }}
          >
            Encre &amp; Cobalt
          </span>
          <span
            className="font-inter font-semibold uppercase tracking-[0.16em]"
            style={{
              fontSize: '0.62rem',
              color: light ? 'rgba(255,255,255,0.65)' : '#44474d',
            }}
          >
            Coworking
          </span>
        </span>
      )}
    </Link>
  );
}
