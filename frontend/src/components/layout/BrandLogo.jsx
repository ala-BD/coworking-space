import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

/**
 * BrandLogo — DeskyWork
 * Logo image officiel (mode clair / sombre) + fallback texte
 * Props:
 *   to       — lien (défaut: '/')
 *   compact  — affiche uniquement l'icône logo
 *   light    — force variante claire (sur fonds sombres)
 *   height   — hauteur du logo en px (défaut: 36)
 */
export default function BrandLogo({ to = '/', className = '', compact = false, light, height = 48 }) {
  const { dark } = useTheme();
  const isDark = light !== undefined ? light : dark;

  /* Logo PNG transparent : mode sombre = "logo 2.png", mode clair = "logo 1.png" */
  const logoSrc = isDark ? '/logo 2.png' : '/logo 1.png';

  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 group shrink-0 ${className}`}
      style={{ textDecoration: 'none' }}
    >
      <img
        src={logoSrc}
        alt="DeskyWork"
        style={{
          height: compact ? height * 0.85 : height,
          width: 'auto',
          maxHeight: 'none',
          objectFit: 'contain',
          transform: 'scale(2.2)',
          transformOrigin: 'left center',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          display: 'block',
        }}
        className="group-hover:scale-110"
      />

      {/* Nom textuel visible uniquement si compact=false ET logo non chargé (fallback) */}
      {!compact && (
        <noscript>
          <span
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: isDark ? '#fbffff' : '#100f0d',
              letterSpacing: '-0.01em',
            }}
          >
            DeskyWork
          </span>
        </noscript>
      )}
    </Link>
  );
}
