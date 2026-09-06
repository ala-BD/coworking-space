import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { guestApi } from '../services/api';
import BrandLogo from '../components/layout/BrandLogo';

/* ─── Charte DeskyWork ─── */
const EC = {
  navy: '#100f0d',
  cobalt: '#f95d00',
  white: '#ffffff',
  bg: '#fbffff',
  onNavy: '#798bac',
  muted: '#44474d',
  outline: '#c5c6ce',
};

const SPACE_LABELS = {
  open_space: 'Open Space',
  private_office: 'Bureau privé',
  meeting_room: 'Salle de réunion',
  training_room: 'Salle de formation',
  event_space: 'Espace événementiel',
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=600&fit=crop';

function mapsLink(coworking) {
  if (coworking.latitude && coworking.longitude) {
    return `https://www.google.com/maps?q=${coworking.latitude},${coworking.longitude}`;
  }
  const q = [coworking.adresse, coworking.ville, coworking.pays].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || coworking.nom)}`;
}

export default function CoworkingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [coworking, setCoworking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await guestApi.getCoworking(id);
        if (res.error || !res.coworking) throw new Error(res.error || 'Coworking introuvable.');
        setCoworking(res.coworking);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: EC.bg }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid rgba(249,93,0,0.2)', borderTopColor: EC.cobalt, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !coworking) {
    return (
      <div style={{ minHeight: '100vh', background: EC.bg, fontFamily: 'Inter, sans-serif' }}>
        <TopBar />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '6rem 24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: EC.cobalt }}>error</span>
          <h1 style={{ fontFamily: 'Sora', fontWeight: 700, color: EC.navy, margin: '12px 0 6px' }}>
            Coworking introuvable
          </h1>
          <p style={{ color: EC.muted, marginBottom: 24 }}>{error || 'Cet espace n\'existe pas ou n\'est plus actif.'}</p>
          <Link to="/" style={{ background: EC.cobalt, color: EC.white, padding: '12px 28px', borderRadius: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const c = coworking;
  const heroImg = c.cover_url || c.logo_url || FALLBACK_IMG;

  return (
    <div style={{ minHeight: '100vh', background: EC.bg, fontFamily: 'Inter, sans-serif', paddingBottom: 64 }}>
      <TopBar />

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: 380, overflow: 'hidden' }}>
        <img src={heroImg} alt={c.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,15,13,0.95) 0%, rgba(16,15,13,0.15) 60%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem 24px' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {c.logo_url && (
                <img src={c.logo_url} alt="logo"
                  style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'contain', background: EC.white, border: '2px solid rgba(255,255,255,0.6)', padding: 6 }} />
              )}
              <div>
                <span style={{ background: EC.cobalt, color: EC.white, borderRadius: 8, padding: '4px 12px', fontSize: '.72rem', fontWeight: 700, display: 'inline-block', marginBottom: 8 }}>
                  {c.ville || c.pays || 'Tunisie'}
                </span>
                <h1 style={{ fontFamily: 'Sora', fontWeight: 800, color: EC.white, fontSize: 'clamp(1.8rem,4vw,2.6rem)', margin: 0 }}>{c.nom}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '2rem 24px 0' }}>

        {/* ── INFOS / COORDONNÉES ── */}
        <div className="row g-4 mb-5">
          <div className="col-lg-7">
            <h2 style={{ fontFamily: 'Sora', fontWeight: 700, color: EC.navy, fontSize: '1.4rem', marginBottom: 12 }}>À propos</h2>
            <p style={{ color: EC.muted, lineHeight: 1.85 }}>
              {c.description || 'Espace de coworking premium pour professionnels ambitieux.'}
            </p>
          </div>
          <div className="col-lg-5">
            <div style={{ background: EC.white, borderRadius: 20, border: `1.5px solid ${EC.outline}`, padding: '1.5rem', boxShadow: '0 4px 16px rgba(16,15,13,0.06)' }}>
              <h3 style={{ fontFamily: 'Sora', fontWeight: 700, color: EC.navy, fontSize: '1rem', marginBottom: 16 }}>Coordonnées & accès</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {c.adresse && (
                  <InfoRow icon="location_on" label="Adresse" value={`${c.adresse}${c.ville ? `, ${c.ville}` : ''}`} />
                )}
                {c.latitude && c.longitude && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#ffedd8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: EC.cobalt, fontSize: 20 }}>place</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '.72rem', fontWeight: 700, color: EC.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>GPS</div>
                      <a href={mapsLink(c)} target="_blank" rel="noreferrer" style={{ color: EC.cobalt, fontWeight: 600, fontSize: '.9rem', textDecoration: 'none' }}>
                        Voir sur la carte
                      </a>
                    </div>
                  </div>
                )}
                {c.telephone && <InfoRow icon="phone" label="Téléphone" value={c.telephone} />}
                {c.email && <InfoRow icon="mail" label="Email" value={c.email} />}
                {c.site_web && <InfoRow icon="public" label="Site web" value={c.site_web} link />}
              </div>
            </div>
          </div>
        </div>

        {/* ── ESPACES ── */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
          <div>
            <h2 style={{ fontFamily: 'Sora', fontWeight: 700, color: EC.navy, fontSize: '1.4rem', margin: 0 }}>Espaces disponibles</h2>
            <p style={{ color: EC.muted, fontSize: '.9rem', margin: '4px 0 0' }}>
              Réservez sans compte — sélectionnez un espace et vos horaires.
            </p>
          </div>
          <Link to={`/book-guest?tenantId=${c.id}`}
            style={{ background: EC.cobalt, color: EC.white, padding: '12px 22px', borderRadius: 12, fontWeight: 700, textDecoration: 'none', fontSize: '.9rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: '-3px', marginRight: 6 }}>event_available</span>
            Réserver en tant qu'invité
          </Link>
        </div>

        {!c.espaces || c.espaces.length === 0 ? (
          <div className="text-center" style={{ background: EC.white, border: `1.5px solid ${EC.outline}`, borderRadius: 20, padding: '3rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: EC.outline }}>room</span>
            <p style={{ color: EC.muted, margin: '12px 0 0' }}>Aucun espace publié pour le moment.</p>
          </div>
        ) : (
          <div className="row g-4">
            {c.espaces.map((esp) => {
              const img = esp.photo_url || (Array.isArray(esp.photos_urls) && esp.photos_urls[0]) || c.cover_url || FALLBACK_IMG;
              return (
                <div key={esp.id} className="col-md-6 col-lg-4">
                  <div style={{ background: EC.white, borderRadius: 20, overflow: 'hidden', border: `1.5px solid ${EC.outline}`, boxShadow: '0 4px 16px rgba(16,15,13,0.06)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 170, overflow: 'hidden' }}>
                      <img src={img} alt={esp.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ background: '#dae2ff', color: '#001847', padding: '3px 10px', borderRadius: 99, fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                          {SPACE_LABELS[esp.type] || esp.type}
                        </span>
                        {esp.tarif_horaire > 0 && (
                          <span style={{ fontFamily: 'Sora', fontWeight: 800, color: EC.cobalt }}>
                            {parseFloat(esp.tarif_horaire).toFixed(2)} DT <span style={{ fontSize: 11, fontWeight: 400, color: EC.muted }}>/ h</span>
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontFamily: 'Sora', fontWeight: 700, color: EC.navy, fontSize: '1.05rem', marginBottom: 6 }}>{esp.nom}</h3>
                      <p style={{ color: EC.muted, fontSize: '.82rem', margin: '0 0 1rem', flex: 1 }}>
                        Capacité : jusqu'à <strong>{esp.capacite}</strong> personnes.
                      </p>
                      <button
                        onClick={() => navigate(`/book-guest?tenantId=${c.id}&espaceId=${esp.id}`)}
                        style={{ background: EC.cobalt, color: EC.white, border: 'none', borderRadius: 10, padding: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '.85rem' }}
                      >
                        Réserver cet espace
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bandeau membre */}
        <div className="row mt-5">
          <div className="col-12">
            <div style={{ background: EC.navy, borderRadius: 24, padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ color: EC.white }}>
                <h3 style={{ fontFamily: 'Sora', fontWeight: 700, margin: 0 }}>Membre du coworking ?</h3>
                <p style={{ color: EC.onNavy, margin: '6px 0 0', fontSize: '.9rem' }}>Connectez-vous pour accéder à vos réservations et meilleurs tarifs.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/login" style={{ background: EC.cobalt, color: EC.white, padding: '12px 24px', borderRadius: 12, fontWeight: 700, textDecoration: 'none', fontSize: '.9rem' }}>
                  Se connecter
                </Link>
                <Link to="/register" style={{ border: '2px solid rgba(255,255,255,0.4)', color: EC.white, padding: '12px 24px', borderRadius: 12, fontWeight: 700, textDecoration: 'none', fontSize: '.9rem' }}>
                  Devenir membre
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function TopBar() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 60, background: 'rgba(251,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(16,15,13,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', maxWidth: 1240, margin: '0 auto' }}>
        <BrandLogo to="/" height={40} />
        <Link to="/book-guest"
          style={{ background: EC.cobalt, color: EC.white, padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '.85rem', textDecoration: 'none' }}>
          Réserver sans compte
        </Link>
      </div>
    </nav>
  );
}

function InfoRow({ icon, label, value, link }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#ffedd8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ color: EC.cobalt, fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color: EC.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
        {link ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer"
            style={{ color: EC.cobalt, fontWeight: 600, fontSize: '.9rem', textDecoration: 'none', wordBreak: 'break-all' }}>{value}</a>
        ) : (
          <div style={{ color: EC.navy, fontWeight: 500, fontSize: '.9rem' }}>{value}</div>
        )}
      </div>
    </div>
  );
}