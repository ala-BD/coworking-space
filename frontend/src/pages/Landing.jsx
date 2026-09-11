import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { guestApi } from '../services/api';
import { API_URL } from '../services/api';
import Navbar from '../components/layout/Navbar';

/* ─── Charte DeskyWork ——— */
const EC = {
  navy: '#100f0d',
  navyMid: '#1c1b18',
  cobalt: '#f95d00',
  cobaltLight: '#dae2ff',
  cobaltDim: '#b1c5ff',
  onNavy: '#798bac',
  white: '#ffffff',
  bg: '#fbf9fb',
  bgLow: '#f5f3f6',
  text: '#1b1b1e',
  muted: '#44474d',
  outline: '#c5c6ce',
  success: '#2fbe8f',
};

/* ─── Animated counter hook ─── */
function useCountUp(target, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      let val = 0;
      const step = Math.max(1, Math.ceil(target / (duration / 16)));
      const timer = setInterval(() => {
        val += step;
        if (val >= target) { setCount(target); clearInterval(timer); }
        else setCount(val);
      }, 16);
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return [count, ref];
}

/* ─── KPI Counter ─── */
function KpiCounter({ value, suffix, label }) {
  const [count, ref] = useCountUp(value);
  return (
    <div ref={ref} className="text-center px-2">
      <div style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 800, color: EC.cobaltLight, fontFamily: 'Sora,sans-serif', lineHeight: 1 }}>
        {count}{suffix}
      </div>
      <div style={{ color: EC.onNavy, fontSize: '.875rem', marginTop: 6 }}>{label}</div>
    </div>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ icon, title, desc }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="col-md-6 col-lg-4">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          backgroundColor: EC.white,
          borderRadius: 20,
          padding: '2rem',
          height: '100%',
          border: `1.5px solid ${hov ? EC.cobalt : EC.outline}`,
          boxShadow: hov ? '0 12px 32px rgba(0,84,203,.14)' : '0 2px 8px rgba(0,13,35,.05)',
          transition: 'all .3s ease',
          transform: hov ? 'translateY(-6px)' : 'none',
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          backgroundColor: hov ? EC.cobalt : EC.cobaltLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem', transition: 'background .3s',
        }}>
          <span className="material-symbols-outlined" style={{ color: hov ? EC.white : EC.navyMid, fontSize: 26 }}>{icon}</span>
        </div>
        <h5 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: EC.navy, marginBottom: '.5rem' }}>{title}</h5>
        <p style={{ color: EC.muted, fontSize: '.9rem', lineHeight: 1.75, margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── Pricing Card ─── */
function PricingCard({ badge, title, price, period, desc, features, highlighted, cta, ctaTo }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="col-md-4">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          backgroundColor: highlighted ? EC.navy : EC.white,
          borderRadius: 24,
          padding: '2rem',
          height: '100%',
          border: highlighted ? 'none' : `1.5px solid ${hov ? EC.cobalt : EC.outline}`,
          boxShadow: hov ? '0 16px 48px rgba(0,13,35,.2)' : highlighted ? '0 8px 32px rgba(0,13,35,.18)' : '0 2px 8px rgba(0,13,35,.04)',
          transition: 'all .3s ease',
          transform: hov ? 'translateY(-4px)' : 'none',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {highlighted && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 160, height: 160,
            background: `radial-gradient(circle,${EC.cobalt}44 0%,transparent 70%)`,
            borderRadius: '50%', transform: 'translate(30%,-30%)', pointerEvents: 'none'
          }} />
        )}
        {badge && (
          <span style={{
            display: 'inline-block', marginBottom: '1rem',
            backgroundColor: highlighted ? EC.cobalt : EC.cobaltLight,
            color: highlighted ? EC.white : EC.navyMid,
            fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '5px 14px', borderRadius: 100,
          }}>{badge}</span>
        )}
        <h4 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: highlighted ? EC.white : EC.navy, marginBottom: '.4rem' }}>{title}</h4>
        <p style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize: '.875rem', marginBottom: '1.5rem' }}>{desc}</p>
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'Sora,sans-serif', color: highlighted ? EC.white : EC.navy }}>{price}</span>
          {period && <span style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize: '.875rem', marginLeft: 4 }}>{period}</span>}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: highlighted ? EC.cobaltDim : EC.cobalt, fontSize: 18, marginTop: 2, flexShrink: 0 }}>check_circle</span>
              <span style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize: '.875rem' }}>{f}</span>
            </li>
          ))}
        </ul>
        <Link to={ctaTo} style={{
          display: 'block', textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '.9rem',
          backgroundColor: highlighted ? EC.cobalt : 'transparent',
          color: highlighted ? EC.white : EC.cobalt,
          border: highlighted ? 'none' : `2px solid ${EC.cobalt}`,
          borderRadius: 12, padding: '12px 0',
          transition: 'all .25s',
        }}>
          {cta}
        </Link>
      </div>
    </div>
  );
}

/* ─── Testimonial Card ─── */
function TestiCard({ quote, name, role, initial }) {
  return (
    <div className="col-md-4">
      <div style={{
        backgroundColor: EC.white, borderRadius: 20, padding: '2rem', height: '100%',
        border: `1.5px solid ${EC.outline}`, boxShadow: '0 4px 16px rgba(0,13,35,.06)',
      }}>
        <div style={{ color: EC.cobalt, fontSize: '2.5rem', fontFamily: 'Georgia,serif', lineHeight: 1, marginBottom: '1rem' }}>"</div>
        <p style={{ color: EC.muted, fontStyle: 'italic', lineHeight: 1.8, fontSize: '.95rem', marginBottom: '1.5rem' }}>{quote}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: EC.cobaltLight, color: EC.cobalt,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1rem', flexShrink: 0,
          }}>{initial}</div>
          <div>
            <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: EC.navy, fontSize: '.9rem' }}>{name}</div>
            <div style={{ color: EC.muted, fontSize: '.8rem' }}>{role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════ */
const HERO_SLIDES = [
  { src: '/images/coworking/space-1.jpg',   title: 'Open Space',         tag: 'Travail collaboratif' },
  { src: '/images/coworking/space-2.jpg',   title: 'Bureaux privatifs',  tag: 'Concentration totale' },
  { src: '/images/coworking/space-3.jpg',   title: 'Bureaux dédiés',     tag: 'Équipes & startups' },
  { src: '/images/coworking/space-4.jpg',   title: 'Salles de réunion',  tag: 'Réunions & workshops' },
  { src: '/images/coworking/space-5.jpg',   title: 'Espace lounge',      tag: 'Pause & networking' },
];

/* ─── Modale Promos ─── */
function PromoModal({ tenant, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    fetch(`${API_URL}/api/public/coworkings/${tenant.id}/promos`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tenant]);

  if (!tenant) return null;

  const ESPACE_LABELS = {
    open_space: 'Open Space',
    private_office: 'Bureau privatif',
    meeting_room: 'Salle de réunion',
    training_room: 'Salle de formation',
    event_space: 'Espace événementiel',
  };

  const ABONNEMENT_LABELS = {
    day_pass: 'Pass Jour',
    week_pass: 'Pass Semaine',
    mensuel: 'Mensuel',
    trimestriel: 'Trimestriel',
    annuel: 'Annuel',
    bureau_prive: 'Bureau privé',
  };

  function fmtDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(16,15,13,.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 24, width: '100%', maxWidth: 560,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,.28)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
          borderRadius: '24px 24px 0 0', padding: '1.5rem 1.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 26 }}>local_offer</span>
              <h3 style={{ margin: 0, color: '#fff', fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: '1.25rem' }}>
                Promotions actives
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,.85)', fontSize: '.85rem' }}>
              {tenant.nom}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff',
              transition: 'background .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.35)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#798bac' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 12, opacity: .5 }}>hourglass_empty</span>
              Chargement des promotions…
            </div>
          ) : (!data?.promo_codes?.length && !data?.tarifs_limites?.length) ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#798bac' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 12, opacity: .4 }}>sentiment_neutral</span>
              Aucune promotion active pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Codes promo */}
              {data?.promo_codes?.length > 0 && (
                <div>
                  <h5 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: '#100f0d', fontSize: '.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#f95d00', fontSize: 20 }}>confirmation_number</span>
                    Codes promotionnels
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.promo_codes.map(p => {
                      const days = daysLeft(p.date_fin);
                      const urgent = days !== null && days <= 7;
                      return (
                        <div key={p.id} style={{
                          border: `1.5px solid ${urgent ? '#f95d00' : '#e5e7eb'}`,
                          borderRadius: 14, padding: '1rem 1.25rem',
                          background: urgent ? '#fff8f5' : '#fafafa',
                          display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                          <div style={{
                            background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
                            borderRadius: 10, padding: '8px 14px',
                            fontFamily: 'Sora,sans-serif', fontWeight: 800,
                            color: '#fff', fontSize: '.9rem', letterSpacing: '.04em',
                            flexShrink: 0,
                          }}>
                            {p.code}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#100f0d', fontSize: '.95rem' }}>
                              {p.type_reduction === 'percent'
                                ? `−${p.valeur}% de réduction`
                                : `−${p.valeur} DT de réduction`}
                            </div>
                            {p.date_fin && (
                              <div style={{ fontSize: '.78rem', color: urgent ? '#f95d00' : '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                {urgent
                                  ? `Expire dans ${days} jour${days !== 1 ? 's' : ''} · ${fmtDate(p.date_fin)}`
                                  : `Valide jusqu'au ${fmtDate(p.date_fin)}`}
                              </div>
                            )}
                            {p.utilisations_max && (
                              <div style={{ fontSize: '.78rem', color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                                {p.utilisations_count} / {p.utilisations_max} utilisations
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tarifs à durée limitée */}
              {data?.tarifs_limites?.length > 0 && (
                <div>
                  <h5 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: '#100f0d', fontSize: '.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#f95d00', fontSize: 20 }}>sell</span>
                    Tarifs promotionnels limités
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.tarifs_limites.map(t => {
                      const days = daysLeft(t.date_fin);
                      const urgent = days !== null && days <= 7;
                      return (
                        <div key={t.id} style={{
                          border: `1.5px solid ${urgent ? '#f95d00' : '#e5e7eb'}`,
                          borderRadius: 14, padding: '1rem 1.25rem',
                          background: urgent ? '#fff8f5' : '#fafafa',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#100f0d', fontSize: '.95rem' }}>
                              {ABONNEMENT_LABELS[t.type_abonnement] || t.type_abonnement}
                              {t.type_espace && (
                                <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '.85rem' }}>
                                  {' '}· {ESPACE_LABELS[t.type_espace] || t.type_espace}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '.78rem', color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
                              Plan {t.plan_tarifaire}
                            </div>
                            {t.date_fin && (
                              <div style={{ fontSize: '.78rem', color: urgent ? '#f95d00' : '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                {urgent
                                  ? `Expire dans ${days} jour${days !== 1 ? 's' : ''} · ${fmtDate(t.date_fin)}`
                                  : `Jusqu'au ${fmtDate(t.date_fin)}`}
                              </div>
                            )}
                          </div>
                          <div style={{
                            background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
                            borderRadius: 12, padding: '8px 16px', textAlign: 'center', flexShrink: 0,
                          }}>
                            <div style={{ color: '#fff', fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>
                              {t.prix} DT
                            </div>
                            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '.7rem', marginTop: 2 }}>TTC {t.tva_pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.75rem 1.75rem', borderTop: '1px solid #f3f4f6' }}>
          <Link
            to={`/book-guest?tenantId=${tenant.id}`}
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
              color: '#fff', borderRadius: 12, padding: '13px 0', width: '100%',
              fontWeight: 700, fontSize: '.95rem', textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(249,93,0,.35)',
              transition: 'transform .2s, box-shadow .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(249,93,0,.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,93,0,.35)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_available</span>
            Réserver et profiter des promos
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ session }) {
  const [contactForm, setContactForm] = useState({ nom: '', email: '', sujet: '', message: '' });
  const [contactStatus, setContactStatus] = useState({ type: '', text: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const updateScrollState = () => setIsAtTop(window.scrollY <= 24);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  const handleScrollButton = () => {
    window.scrollTo({
      top: isAtTop ? document.documentElement.scrollHeight : 0,
      behavior: 'smooth',
    });
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    setContactLoading(true);
    setContactStatus({ type: '', text: '' });
    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’envoyer le message.');
      setContactForm({ nom: '', email: '', sujet: '', message: '' });
      setContactStatus({ type: 'success', text: data.message });
    } catch (error) {
      setContactStatus({ type: 'error', text: error.message });
    } finally {
      setContactLoading(false);
    }
  };
  const [tenants, setTenants] = useState([]);
  const [slide, setSlide] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [promoTenant, setPromoTenant] = useState(null);
  const paused = hovering || hidden;

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 3000);
    return () => clearInterval(t);
  }, [paused]);

  const goSlide = (dir) => setSlide((s) => (s + dir + HERO_SLIDES.length) % HERO_SLIDES.length);

  const fetchTenants = async () => {
    try {
      const res = await guestApi.getCoworkings();
      if (res.error) throw new Error(res.error);
      setTenants(res.coworkings || []);
    } catch (e) {
      // silencieux
    }
  };

  /* données */
  const features = [
    { icon: 'wifi_tethering', title: 'Wi-Fi Gigabit', desc: 'Fibre symétrique dédiée avec sécurité de niveau entreprise et zéro zone morte dans tous les espaces.' },
    { icon: 'lock_open', title: 'Accès 24/7', desc: "Votre workflow ne s'arrête pas à 17h. Les membres profitent d'un accès biométrique en continu." },
    { icon: 'concierge', title: 'Conciergerie', desc: 'Équipe sur place pour gérer vos livraisons, invités et besoins administratifs avec précision.' },
    { icon: 'meeting_room', title: 'Salles de Réunion', desc: 'Salles équipées de projecteurs 4K, tableaux blancs interactifs et systèmes de visioconférence.' },
    { icon: 'local_cafe', title: 'Café & Détente', desc: 'Espace lounge avec café de spécialité illimité, cuisine équipée et terrasse végétalisée.' },
    { icon: 'print', title: 'Équipements Pros', desc: 'Imprimantes A3 couleur, scanners, casiers sécurisés et adresse postale professionnelle.' },
  ];

  const plans = [
    {
      badge: 'Journalier', title: 'Pass Jour', price: '25 DT', period: '/ jour',
      desc: 'Idéal pour un besoin ponctuel ou pour découvrir l\'espace.',
      features: ['Espace ouvert flex', 'Wi-Fi illimité', 'Café offert', 'Casier journalier', 'Impression 10 pages'],
      cta: 'Réserver maintenant', ctaTo: '/register', highlighted: false,
    },
    {
      badge: '⭐ Le plus populaire', title: 'Abonnement Mensuel', price: '350 DT', period: '/ mois',
      desc: 'La formule préférée de nos membres réguliers.',
      features: ['Accès illimité 24/7', 'Bureau dédié ou flex', 'Salles de réunion 10h/mois', 'Adresse postale', 'Impression 100 pages', 'Café & snacks illimités'],
      cta: 'Commencer aujourd\'hui', ctaTo: '/register', highlighted: true,
    },
    {
      badge: 'Équipe', title: 'Plan Entreprise', price: 'Sur devis', period: '',
      desc: 'Pour les équipes de 5 personnes et plus.',
      features: ['Bureaux privatifs', 'Réunions illimitées', 'Support dédié', 'Facturation mensuelle', 'Multi-sites', 'Espace personnalisé'],
      cta: 'Contactez-nous', ctaTo: '#contact', highlighted: false,
    },
  ];

  const testimonials = [
    { quote: 'Travailler chez DeskyWork a transformé ma productivité. L\'ambiance, les équipements et l\'équipe sont au top. Je ne pourrais plus m\'en passer.', name: 'Sarra Ben Amor', role: 'CEO · TechStart Tunis', initial: 'S' },
    { quote: 'La meilleure décision pour notre équipe. Espaces flexibles, accès 24/7 et une communauté de professionnels motivants au quotidien.', name: 'Mehdi Karoui', role: 'CTO · DevFactory', initial: 'M' },
    { quote: 'Un coworking qui comprend vraiment les freelances. Tarifs clairs, atmosphère calme et un service client irréprochable.', name: 'Nadia Ferchichi', role: 'Designer UX · Freelance', initial: 'N' },
  ];

  return (
    <>
      {/* ── Styles globaux ── */}
      <style>{`
        html { scroll-behavior:smooth; scroll-padding-top:80px; }
        body { font-family:'Inter',sans-serif; background-color:#fbffff; color:#100f0d; }
        .sora { font-family:'Sora',sans-serif !important; }

        /* NAV — styles gérés dans Navbar.jsx */

        /* HERO — Background plein écran + slideshow */
        .hero-wrap {
          position:relative; min-height:92vh; display:flex; align-items:center; padding-top:90px; overflow:hidden; background:#100f0d;
        }
        .hero-bg { position:absolute; inset:0; z-index:0; }
        .hero-bg-slide { position:absolute; inset:0; opacity:0; visibility:hidden; transition:opacity 1.4s cubic-bezier(.25,.46,.45,.94), visibility 1.4s; }
        .hero-bg-slide.active { opacity:1; visibility:visible; }
        .hero-bg-slide img { width:100%; height:100%; object-fit:cover; display:block; transform:scale(1.02); }
        .hero-bg-slide.active img.kb-a { animation:kbA 9s ease-out forwards; }
        .hero-bg-slide.active img.kb-b { animation:kbB 9s ease-out forwards; }
        @keyframes kbA { from{transform:scale(1.02) translate(0,0)} to{transform:scale(1.2) translate(-1.8%,-1.3%)} }
        @keyframes kbB { from{transform:scale(1.2) translate(-1.8%,-1.3%)} to{transform:scale(1.03) translate(.6%,.8%)} }
        .hero-shade { position:absolute; inset:0; z-index:1; background:linear-gradient(105deg, rgba(16,15,13,.9) 30%, rgba(16,15,13,.55) 58%, rgba(16,15,13,.25) 100%); }
        .hero-vignette { position:absolute; inset:0; z-index:2; background:radial-gradient(ellipse at 20% 60%, rgba(16,15,13,0) 0%, rgba(16,15,13,.45) 100%); }
        .hero-content { position:relative; z-index:5; width:100%; }
        .hero-cap-badge { display:inline-flex; align-items:center; gap:8px; background:rgba(251,255,255,.1); backdrop-filter:blur(10px); color:#fff; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; padding:7px 16px; border-radius:100px; border:1px solid rgba(255,255,255,.18); }
        .hero-cap-badge .live-dot { background:#2fbe8f; }
        .hero-title { color:#fff; text-shadow:0 4px 30px rgba(16,15,13,.5); }
        .hero-title .accent { color:#ff8a3d; }
        .hero-rule { width:76px; height:4px; border-radius:4px; background:linear-gradient(90deg,#f95d00,#ffb285); margin:20px 0 26px; transform-origin:left center; opacity:0; animation:ruleGrow .9s cubic-bezier(.2,.7,.2,1) 1.05s forwards; box-shadow:0 2px 14px rgba(249,93,0,.5); }
        @keyframes ruleGrow { from{transform:scaleX(0); opacity:0} to{transform:scaleX(1); opacity:1} }
        .hero-sub { color:rgba(255,255,255,.82); text-shadow:0 2px 12px rgba(16,15,13,.4); }
        .hero-meta { color:rgba(255,255,255,.86); }
        .hero-meta strong { color:#fff; }
        .hero-fly { animation:heroFly 1s cubic-bezier(.2,.7,.2,1) both; }
        .hero-fly-1 { animation-delay:.15s; }
        .hero-fly-2 { animation-delay:.3s; }
        .hero-fly-3 { animation-delay:.45s; }
        @keyframes heroFly { from{opacity:0; transform:translateY(26px); filter:blur(8px)} to{opacity:1; transform:translateY(0); filter:blur(0)} }
        .hero-title .fl-word { display:inline-block; opacity:0; transform:translateY(40px) scale(.96); animation:wordUp .7s cubic-bezier(.2,.7,.2,1) forwards; }
        .hero-title .fl-accent { display:inline-block; color:#ff8a3d; opacity:0; animation:wordUp .8s .85s cubic-bezier(.2,.7,.2,1) both, accentGlow 3.4s ease-in-out 2s infinite; text-shadow:0 0 18px rgba(255,138,61,.4); }
        @keyframes wordUp { from{opacity:0; transform:translateY(40px) scale(.96); filter:blur(6px)} to{opacity:1; transform:translateY(0) scale(1); filter:blur(0)} }
        @keyframes accentGlow { 0%,100%{text-shadow:0 0 14px rgba(255,138,61,.3)} 50%{text-shadow:0 0 34px rgba(255,138,61,.8)} }
        .btn-primary-hero { background:#f95d00; color:#fff; border:none; border-radius:12px; padding:13px 30px; font-weight:700; font-size:1rem; transition:all .25s; display:inline-flex; align-items:center; gap:10px; box-shadow:0 10px 30px rgba(249,93,0,.4); }
        .btn-primary-hero:hover { transform:translateY(-2px); box-shadow:0 14px 36px rgba(249,93,0,.5); }
        .btn-ghost-hero { background:rgba(255,255,255,.06); color:#fff; border:2px solid rgba(255,255,255,.45); border-radius:12px; padding:12px 30px; font-weight:700; font-size:1rem; transition:all .25s; display:inline-flex; align-items:center; gap:10px; backdrop-filter:blur(6px); }
        .btn-ghost-hero:hover { background:#fff; color:#100f0d; border-color:#fff; }
        .font-sora { font-family:'Sora',sans-serif !important; }
        .hero-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:6; width:40px; height:40px; border-radius:50%; border:1px solid rgba(255,255,255,.35); background:rgba(16,15,13,.32); color:#fff; backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:.8; transition:opacity .25s, background .25s, transform .25s; }
        .hero-arrow.prev { left:16px; }
        .hero-arrow.next { right:16px; }
        .hero-arrow:hover { background:rgba(249,93,0,.85); border-color:transparent; opacity:1; transform:translateY(-50%) scale(1.08); }
        .live-dot { width:10px; height:10px; border-radius:50%; background:#2fbe8f; animation:pulse 2s infinite; flex-shrink:0; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(47,190,143,.45)} 50%{box-shadow:0 0 0 8px rgba(47,190,143,0)} }

        /* TRUST */
        .trust-bar { background:#ffedd8; border-top:1px solid rgba(249,93,0,.12); border-bottom:1px solid rgba(249,93,0,.12); }
        .trust-name { font-family:'Sora',sans-serif; font-weight:700; font-size:1.05rem; color:#100f0d; opacity:.5; transition:opacity .2s; cursor:default; }
        .trust-name:hover { opacity:1; }

        /* KPI */
        .kpi-strip { background:#100f0d; }

        /* SECTION BADGE */
        .sec-badge { display:inline-block; background:#ffedd8; color:#100f0d; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:6px 18px; border-radius:100px; margin-bottom:1rem; }
        .sec-badge.inv { background:rgba(249,93,0,.15); color:#f95d00; }

        /* SPACES */
        .space-card { position:relative; border-radius:20px; overflow:hidden; cursor:pointer; }
        .space-card img { width:100%; height:100%; object-fit:cover; transition:transform .6s ease; display:block; }
        .space-card:hover img { transform:scale(1.06); }
        .space-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(16,15,13,.92) 0%,transparent 65%); }
        .space-body { position:absolute; bottom:0; left:0; right:0; padding:1.5rem; }

        /* CTA SECTION */
        .cta-sec { background:linear-gradient(135deg,#100f0d 0%,#26170a 100%); position:relative; overflow:hidden; }
        .cta-grid { position:absolute; inset:0; background-image:radial-gradient(circle at 2px 2px,rgba(251,255,255,.05) 1px,transparent 0); background-size:40px 40px; }

        /* CONTACT */
        .ec-input { width:100%; border:1.5px solid #cfcac3; border-radius:12px; padding:13px 16px; font-size:.9rem; font-family:'Inter',sans-serif; background:#fbffff; color:#100f0d; transition:border-color .2s,box-shadow .2s; }
        .ec-input:focus { outline:none; border-color:#f95d00; box-shadow:0 0 0 4px rgba(249,93,0,.15); }
        .ec-input::placeholder { color:#8e8a83; }

        /* FOOTER */
        .ec-footer { background:#100f0d; }
        .ec-footer a { color:#ffffff !important; text-decoration:none; font-size:.875rem; transition:color .2s; }
        .ec-footer a:hover { color:#f95d00 !important; }
        .ec-footer p { color:#ffffff !important; }
        .ec-footer h6 { color:#ffffff !important; }
        .soc-btn { width:38px; height:38px; border-radius:50%; background:rgba(251,255,255,.08); display:inline-flex; align-items:center; justify-content:center; color:#a3a09b; text-decoration:none; transition:all .2s; margin-right:8px; }
        .soc-btn:hover { background:#f95d00; color:#fbffff; }

        /* ANIMATIONS */
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .fa { animation:fadeUp .75s ease both; }
        .fa-1 { animation-delay:.12s; }
        .fa-2 { animation-delay:.24s; }

        @media(max-width:767px) {
          .hero-wrap { min-height:86vh; padding:110px 0 70px; }
          .hero-bg-slide img.kb-a, .hero-bg-slide img.kb-b { animation:none; }
          .hero-shade { background:linear-gradient(180deg, rgba(16,15,13,.78) 0%, rgba(16,15,13,.6) 100%); }
          .hero-arrow { display:none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-bg-slide.active img.kb-a, .hero-bg-slide.active img.kb-b { animation:none; }
          .hero-bg-slide { transition:none; }
          .hero-title .fl-word, .hero-title .fl-accent, .hero-fly { animation:none; opacity:1; transform:none; filter:none; }
        }

        /* BADGE PROMO */
        @keyframes promoPulse {
          0%,100% { box-shadow:0 4px 14px rgba(249,93,0,.55); }
          50%      { box-shadow:0 4px 22px rgba(249,93,0,.9); }
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <Navbar session={session} />

      {/* ══ HERO ══ */}
      <section className="hero-wrap">
        {/* Slideshow plein écran en arrière-plan */}
        <div className="hero-bg" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
          {HERO_SLIDES.map((s, i) => (
            <div key={s.src} className={`hero-bg-slide ${i === slide ? 'active' : ''}`} aria-hidden={i !== slide}>
              <img
                src={s.src}
                alt={''}
                loading={i === 0 ? 'eager' : 'lazy'}
                className={i % 2 === 0 ? 'kb-a' : 'kb-b'}
              />
            </div>
          ))}
        </div>
        <div className="hero-shade" />
        <div className="hero-vignette" />

        <div className="hero-content container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <span className="hero-cap-badge hero-fly hero-fly-1">
                <span className="live-dot" /> Coworking Premium · Tunis
              </span>

              <h1 className="sora fw-bold hero-title mb-0" style={{ fontSize: 'clamp(2.4rem,5.4vw,4rem)', lineHeight: 1.12, letterSpacing: '-.025em', marginTop: '1.1rem' }}>
                {'Réservez votre espace idéal en'.split(' ').map((w, wi) => (
                  <span key={wi} className="fl-word" style={{ animationDelay: `${0.4 + wi * 0.08}s` }}>{w}&nbsp;</span>
                ))}
                <span className="fl-accent">3&nbsp;clics</span>
              </h1>
              <div className="hero-rule" />

              <p className="hero-sub hero-fly hero-fly-2 mb-4" style={{ fontSize: '1.15rem', lineHeight: 1.8, maxWidth: 540 }}>
                <span className="hero-fly hero-fly-2">DeskyWork offre des espaces de travail conçus pour les professionnels ambitieux.</span>
                <br className="d-none d-md-block" />
                <span className="hero-fly hero-fly-2" style={{ animationDelay: '.55s' }}>Rejoignez une communauté d'excellence au cœur de Tunis.</span>
              </p>

              <div className="d-flex align-items-center gap-3 mb-4 hero-fly hero-fly-2">
                <div className="d-flex">
                  {['S', 'M', 'N', 'K'].map((l, i) => (
                    <div key={i} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.78rem', marginLeft: i > 0 ? -8 : 0 }}>{l}</div>
                  ))}
                </div>
                <p className="hero-meta mb-0" style={{ fontSize: '.9rem' }}>
                  <strong>+200 membres</strong> nous font confiance
                </p>
              </div>

              <div className="d-flex flex-wrap gap-3 hero-fly hero-fly-3">
                <Link to={session ? '/dashboard' : '/book-guest'} className="btn-primary-hero">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_available</span>
                  {session ? 'Accéder au Portail' : 'Réserver sans compte'}
                </Link>
                <Link to="/register" className="btn-ghost-hero">
                  Devenir membre
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Flèches ancrés sur les côtés du hero */}
        <button type="button" className="hero-arrow prev" onClick={() => goSlide(-1)} aria-label="Image précédente">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
        </button>
        <button type="button" className="hero-arrow next" onClick={() => goSlide(1)} aria-label="Image suivante">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
        </button>
      </section>

      {/* ══ TRUST BAR ══ */}
      <section className="trust-bar py-4">
        <div className="container">
          <p className="text-center mb-3" style={{ color: EC.cobalt, fontSize: '.7rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            Ils nous font confiance
          </p>
          <div className="d-flex flex-wrap justify-content-center align-items-center gap-5">
            <a href="https://thirtythreespace.com/" target="_blank" rel="noopener noreferrer" className="trust-name">Thirty Three Space</a>
            <span className="trust-name">néro coworking space</span>
          </div>
        </div>
      </section>

      {/* ══ KPI STRIP ══ */}
      <section className="kpi-strip py-5">
        <div className="container">
          <div className="row g-4 justify-content-center">
            {[{ value: 200, suffix: '+', label: 'Membres actifs' }, { value: 12, suffix: '', label: 'Espaces disponibles' }, { value: 98, suffix: '%', label: 'Taux de satisfaction' }, { value: 3, suffix: '+', label: "Années d'expérience" }].map((k, i) => (
              <div key={i} className="col-6 col-md-3">
                <KpiCounter {...k} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AVANTAGES ══ */}
      <section id="avantages" className="py-5" style={{ backgroundColor: EC.bgLow }}>
        <div className="container py-4">
          <div className="row mb-5">
            <div className="col-lg-7">
              <span className="sec-badge">Nos atouts</span>
              <h2 className="sora fw-bold mb-3" style={{ color: EC.navy, fontSize: 'clamp(1.8rem,3vw,2.4rem)', letterSpacing: '-.02em' }}>
                Le Standard DeskyWork
              </h2>
              <p style={{ color: EC.muted, fontSize: '1.05rem', lineHeight: 1.8 }}>
                Nous avons éliminé tous les points de friction entre vous et votre meilleur travail.
                Des équipements premium conçus pour maximiser votre concentration et créativité.
              </p>
            </div>
          </div>
          <div className="row g-4">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ══ ESPACES ══ */}
      <section id="espaces" className="py-5" style={{ backgroundColor: EC.navy }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge inv">Nos espaces</span>
            <h2 className="sora fw-bold text-white mb-3" style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>
              Espaces de Coworking
            </h2>
            <p style={{ color: EC.onNavy, maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
              Découvrez nos espaces de coworking disponibles et réservez votre place dès maintenant.
            </p>
          </div>
          {tenants.length === 0 ? (
            <div className="text-center py-5">
              <p style={{ color: EC.onNavy, fontSize: '1rem' }}>Aucun espace disponible pour le moment.</p>
            </div>
          ) : (
            <div className="row g-4">
              {tenants.map((tenant) => (
                <div key={tenant.id} className="col-lg-4">
                  <div className="space-card" style={{ height: 380 }}>
                    <img
                      src={tenant.cover_url || tenant.logo_url || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop"}
                      alt={tenant.nom}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="space-overlay" />

                    {/* ── Badge PROMO ── */}
                    {tenant.has_promo && (
                      <div style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
                        color: '#fff',
                        borderRadius: 10,
                        padding: '5px 12px',
                        fontSize: '.7rem',
                        fontWeight: 800,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: '0 4px 14px rgba(249,93,0,.55)',
                        zIndex: 4,
                        animation: 'promoPulse 2.4s ease-in-out infinite',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>local_offer</span>
                        PROMO
                        {tenant.promo_count > 1 && (
                          <span style={{
                            background: 'rgba(255,255,255,.3)',
                            borderRadius: 6,
                            padding: '1px 6px',
                            fontSize: '.65rem',
                            fontWeight: 700,
                          }}>
                            ×{tenant.promo_count}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-body">
                      <span style={{ backgroundColor: EC.cobalt, color: 'white', borderRadius: 8, padding: '4px 12px', fontSize: '.72rem', fontWeight: 700, display: 'inline-block', marginBottom: 8 }}>
                        {tenant.ville || tenant.pays || 'Tunisie'}
                      </span>
                      <h3 className="sora fw-bold text-white mb-2">{tenant.nom}</h3>
                      <p className="mb-1" style={{ color: EC.onNavy, fontSize: '.9rem', maxWidth: 460 }}>
                        {tenant.description || 'Espace de coworking premium pour professionnels ambitieux.'}
                      </p>
                      <div className="d-flex align-items-center gap-3 mb-3" style={{ color: EC.onNavy, fontSize: '.8rem' }}>
                        {tenant.adresse && (
                          <span className="d-inline-flex align-items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>location_on</span>
                            {tenant.adresse}
                          </span>
                        )}
                        {tenant.telephone && (
                          <span className="d-inline-flex align-items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>phone</span>
                            {tenant.telephone}
                          </span>
                        )}
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <Link
                          to={`/coworking/${tenant.id}`}
                          className="btn d-inline-flex align-items-center gap-2"
                          style={{ backgroundColor: EC.cobalt, color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 700, border: 'none', fontSize: '.9rem', transition: 'all .25s' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                          Voir plus
                        </Link>
                        {tenant.has_promo && (
                          <button
                            onClick={() => setPromoTenant(tenant)}
                            className="btn d-inline-flex align-items-center gap-2"
                            style={{
                              background: 'linear-gradient(135deg,#f95d00,#ff8a3d)',
                              color: 'white', border: 'none', borderRadius: 12,
                              padding: '10px 20px', fontWeight: 700, fontSize: '.9rem',
                              transition: 'all .25s', cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(249,93,0,.4)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>local_offer</span>
                            Promotions
                          </button>
                        )}
                        {!tenant.has_promo && (
                          <Link
                            to={`/book-guest?tenantId=${tenant.id}`}
                            className="btn d-inline-flex align-items-center gap-2"
                            style={{ backgroundColor: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,.5)', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: '.9rem', transition: 'all .25s' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>event_available</span>
                            Réserver
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ TARIFS ══ */}
      <section id="tarifs" className="py-5" style={{ backgroundColor: EC.bgLow }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge">Tarifs Transparents</span>
            <h2 className="sora fw-bold mb-3" style={{ color: EC.navy, fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>
              Choisissez votre formule
            </h2>
            <p style={{ color: EC.muted, maxWidth: 480, margin: '0 auto' }}>
              Pas de frais cachés. Pas de mauvaises surprises. Juste de la productivité pure.
            </p>
          </div>
          <div className="row g-4 align-items-stretch">
            {plans.map((p, i) => <PricingCard key={i} {...p} />)}
          </div>
        </div>
      </section>

      {/* ══ TÉMOIGNAGES ══ */}
      <section id="temoignages" className="py-5" style={{ backgroundColor: EC.bg }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge">Témoignages</span>
            <h2 className="sora fw-bold mb-3" style={{ color: EC.navy, fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>
              Ils adorent DeskyWork
            </h2>
          </div>
          <div className="row g-4">
            {testimonials.map((t, i) => <TestiCard key={i} {...t} />)}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="cta-sec py-5">
        <div className="cta-grid" />
        <div className="container py-5 position-relative text-center">
          <span className="sec-badge inv">Passez à l'action</span>
          <h2 className="sora fw-bold text-white mb-4" style={{ fontSize: 'clamp(2rem,4vw,3rem)', maxWidth: 620, margin: '0 auto 1rem' }}>
            Prêt à faire votre meilleur travail ?
          </h2>
          <p className="mb-5" style={{ color: EC.onNavy, maxWidth: 500, margin: '0 auto 2.5rem', lineHeight: 1.8 }}>
            Vivez la différence DeskyWork avec un pass journalier ou un abonnement complet.
            Rejoignez +200 professionnels qui ont choisi l'excellence.
          </p>
          <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
            <Link to={session ? '/dashboard' : '/register'} className="btn d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: EC.cobalt, color: 'white', borderRadius: 12, padding: '15px 36px', fontWeight: 700, border: 'none', fontSize: '1rem', transition: 'all .25s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,84,203,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_available</span>
              Réserver un Pass Jour
            </Link>
            <Link to="/register" className="btn d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: '#ffffff', color: EC.navy, border: 'none', borderRadius: 12, padding: '15px 36px', fontWeight: 700, fontSize: '1rem', transition: 'all .25s', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#fff3ec'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.backgroundColor = '#ffffff'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person_add</span>
              Devenir Membre
            </Link>
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section id="contact" className="py-5" style={{ backgroundColor: EC.bg }}>
        <div className="container py-4">
          <div className="row g-5 align-items-start">
            <div className="col-lg-5">
              <span className="sec-badge">Contact</span>
              <h2 className="sora fw-bold mb-4" style={{ color: EC.navy, fontSize: 'clamp(1.8rem,3vw,2.2rem)' }}>
                Venez nous rendre visite
              </h2>
              <div className="d-flex flex-column gap-4">
                {[
                  { icon: 'location_on', label: 'Adresse', val: 'Montplaisir, Tunis' },
                  { icon: 'phone', label: 'Téléphone', val: '+216 52 882 880\n+216 52 882 930' },
                  { icon: 'mail', label: 'Email', val: 'contact@vclow.com' },
                  { icon: 'schedule', label: 'Horaires', val: 'Lun–Ven 7h–22h · Week-end 9h–18h' },
                ].map(({ icon, label, val }) => (
                  <div key={icon} className="d-flex gap-3 align-items-start">
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: EC.cobaltLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: EC.cobalt, fontSize: 22 }}>{icon}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '.72rem', fontWeight: 700, color: EC.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{label}</div>
                      <div style={{ color: EC.navy, fontWeight: 500, whiteSpace: 'pre-line' }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-lg-7">
              <div style={{ backgroundColor: EC.white, borderRadius: 24, padding: '2.5rem', boxShadow: '0 8px 32px rgba(0,13,35,.08)', border: `1.5px solid ${EC.outline}` }}>
                <h4 className="sora fw-bold mb-4" style={{ color: EC.navy }}>Envoyez-nous un message</h4>
                <form onSubmit={handleContactSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="fw-semibold mb-2 d-block" style={{ color: EC.navy, fontSize: '.875rem' }}>Prénom &amp; Nom</label>
                      <input type="text" required className="ec-input" placeholder="Votre nom complet" value={contactForm.nom} onChange={e => setContactForm(f => ({ ...f, nom: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="fw-semibold mb-2 d-block" style={{ color: EC.navy, fontSize: '.875rem' }}>Email</label>
                      <input type="email" required className="ec-input" placeholder="votre@email.com" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="fw-semibold mb-2 d-block" style={{ color: EC.navy, fontSize: '.875rem' }}>Sujet</label>
                      <select required className="ec-input" value={contactForm.sujet} onChange={e => setContactForm(f => ({ ...f, sujet: e.target.value }))}>
                        <option value="">Choisir un sujet…</option>
                        <option>Visite de l'espace</option>
                        <option>Abonnement mensuel</option>
                        <option>Solution entreprise</option>
                        <option>Autre demande</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="fw-semibold mb-2 d-block" style={{ color: EC.navy, fontSize: '.875rem' }}>Message</label>
                      <textarea required className="ec-input" rows={4} placeholder="Décrivez votre besoin…" style={{ resize: 'vertical' }} value={contactForm.message} onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <button type="submit" disabled={contactLoading} className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                        style={{ backgroundColor: EC.cobalt, color: 'white', borderRadius: 12, padding: '14px', fontWeight: 700, border: 'none', fontSize: '1rem', transition: 'all .25s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,84,203,.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
                        {contactLoading ? 'Envoi en cours...' : 'Envoyer le message'}
                      </button>
                      {contactStatus.text && <div className="mt-3" role="status" style={{ color: contactStatus.type === 'success' ? '#15803d' : '#b91c1c', fontWeight: 600 }}>{contactStatus.text}</div>}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="ec-footer pt-5 pb-4" style={{ background: '#0d1117', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="container">
          <div className="row g-4 mb-5 align-items-start">
            <div className="col-lg-4 col-md-6">
              <div style={{ marginBottom: '1.25rem' }}>
                <img src="/logo 2.png" alt="DeskyWork" style={{ height: 54, width: 'auto', objectFit: 'contain', transform: 'scale(2.2)', transformOrigin: 'left center' }} />
              </div>
              <p style={{ color: '#f8fafc', fontSize: '.95rem', lineHeight: 1.8, maxWidth: 330, margin: 0, fontWeight: 500 }}>
                Espaces de travail premium pour les professionnels modernes. Situé au cœur de Tunis depuis 2021.
              </p>
              <div className="mt-4 d-flex gap-3">
                <a href="#contact" aria-label="Contact" className="soc-btn" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: '#ffffff' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>public</span>
                </a>
                <a href="mailto:contact@vclow.com" aria-label="Email" className="soc-btn" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: '#ffffff' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>alternate_email</span>
                </a>
                <a href="#contact" aria-label="Messagerie" className="soc-btn" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: '#ffffff' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
                </a>
              </div>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <h6 className="fw-bold mb-3" style={{ color: '#ffffff', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Explorer</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#espaces" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Trouver un espace</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Réunions & Événements</a></li>
                <li><a href="#tarifs" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Plans Membres</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Solutions Entreprises</a></li>
              </ul>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <h6 className="fw-bold mb-3" style={{ color: '#ffffff', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Société</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#avantages" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>À propos</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Carrières</a></li>
                <li><a href="#temoignages" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Blog</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Réseau Partenaires</a></li>
              </ul>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <h6 className="fw-bold mb-3" style={{ color: '#ffffff', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Légal</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Politique de confidentialité</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Conditions d'utilisation</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Cookies</a></li>
                <li><a href="#top" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Plan du site</a></li>
              </ul>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <h6 className="fw-bold mb-3" style={{ color: '#ffffff', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Contact</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="tel:+21600000000" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>+216 00 000 000</a></li>
                <li><a href="mailto:contact@vclow.com" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>contact@vclow.com</a></li>
                <li><a href="#contact" style={{ color: '#f8fafc', fontWeight: 500, textDecoration: 'none' }}>Tunis, Tunisie</a></li>
              </ul>
            </div>
          </div>

          <hr style={{ borderColor: 'rgba(255,255,255,.12)', margin: 0 }} />
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center pt-4 gap-2">
            <p className="mb-0" style={{ color: '#f8fafc', fontSize: '.85rem', fontWeight: 500 }}>
              © {new Date().getFullYear()} DeskyWork. Tous droits réservés.
            </p>
            <p className="mb-0" style={{ color: '#f8fafc', fontSize: '.85rem', fontWeight: 500 }}>
              Conçu avec <span style={{ color: EC.cobalt }}>♥</span> à Tunis
            </p>
          </div>
        </div>
      </footer>

      <button
        type="button"
        aria-label={isAtTop ? 'Faire défiler vers le bas' : 'Retour en haut'}
        title={isAtTop ? 'Faire défiler vers le bas' : 'Retour en haut'}
        onClick={handleScrollButton}
        className="back-to-top"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, transition: 'transform 0.3s ease', transform: `rotate(${isAtTop ? 180 : 0}deg)` }}
        >
          keyboard_arrow_up
        </span>
      </button>

      {/* ══ MODALE PROMOS ══ */}
      {promoTenant && (
        <PromoModal tenant={promoTenant} onClose={() => setPromoTenant(null)} />
      )}
    </>
  );
}
