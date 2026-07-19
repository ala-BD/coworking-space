import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/layout/Navbar';

/* ─── Charte Encre & Cobalt ─── */
const EC = {
  navy:        '#000d23',
  navyMid:     '#10233f',
  cobalt:      '#0054cb',
  cobaltLight: '#dae2ff',
  cobaltDim:   '#b1c5ff',
  onNavy:      '#798bac',
  white:       '#ffffff',
  bg:          '#fbf9fb',
  bgLow:       '#f5f3f6',
  text:        '#1b1b1e',
  muted:       '#44474d',
  outline:     '#c5c6ce',
  success:     '#2fbe8f',
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
          <div style={{ position:'absolute', top:0, right:0, width:160, height:160,
            background:`radial-gradient(circle,${EC.cobalt}44 0%,transparent 70%)`,
            borderRadius:'50%', transform:'translate(30%,-30%)', pointerEvents:'none' }} />
        )}
        {badge && (
          <span style={{
            display:'inline-block', marginBottom:'1rem',
            backgroundColor: highlighted ? EC.cobalt : EC.cobaltLight,
            color: highlighted ? EC.white : EC.navyMid,
            fontSize:'.7rem', fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
            padding:'5px 14px', borderRadius:100,
          }}>{badge}</span>
        )}
        <h4 style={{ fontFamily:'Sora,sans-serif', fontWeight:700, color: highlighted ? EC.white : EC.navy, marginBottom:'.4rem' }}>{title}</h4>
        <p style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize:'.875rem', marginBottom:'1.5rem' }}>{desc}</p>
        <div style={{ marginBottom:'1.5rem' }}>
          <span style={{ fontSize:'2.6rem', fontWeight:800, fontFamily:'Sora,sans-serif', color: highlighted ? EC.white : EC.navy }}>{price}</span>
          {period && <span style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize:'.875rem', marginLeft:4 }}>{period}</span>}
        </div>
        <ul style={{ listStyle:'none', padding:0, margin:'0 0 1.75rem 0', display:'flex', flexDirection:'column', gap:10 }}>
          {features.map((f, i) => (
            <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <span className="material-symbols-outlined" style={{ color: highlighted ? EC.cobaltDim : EC.cobalt, fontSize:18, marginTop:2, flexShrink:0 }}>check_circle</span>
              <span style={{ color: highlighted ? EC.onNavy : EC.muted, fontSize:'.875rem' }}>{f}</span>
            </li>
          ))}
        </ul>
        <Link to={ctaTo} style={{
          display:'block', textAlign:'center', textDecoration:'none', fontWeight:700, fontSize:'.9rem',
          backgroundColor: highlighted ? EC.cobalt : 'transparent',
          color: highlighted ? EC.white : EC.cobalt,
          border: highlighted ? 'none' : `2px solid ${EC.cobalt}`,
          borderRadius:12, padding:'12px 0',
          transition:'all .25s',
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
        backgroundColor: EC.white, borderRadius:20, padding:'2rem', height:'100%',
        border:`1.5px solid ${EC.outline}`, boxShadow:'0 4px 16px rgba(0,13,35,.06)',
      }}>
        <div style={{ color:EC.cobalt, fontSize:'2.5rem', fontFamily:'Georgia,serif', lineHeight:1, marginBottom:'1rem' }}>"</div>
        <p style={{ color:EC.muted, fontStyle:'italic', lineHeight:1.8, fontSize:'.95rem', marginBottom:'1.5rem' }}>{quote}</p>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:44, height:44, borderRadius:'50%',
            backgroundColor:EC.cobaltLight, color:EC.cobalt,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:'1rem', flexShrink:0,
          }}>{initial}</div>
          <div>
            <div style={{ fontFamily:'Sora,sans-serif', fontWeight:700, color:EC.navy, fontSize:'.9rem' }}>{name}</div>
            <div style={{ color:EC.muted, fontSize:'.8rem' }}>{role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════ */
export default function Landing({ session }) {
  /* données */
  const features = [
    { icon:'wifi_tethering',  title:'Wi-Fi Gigabit',       desc:'Fibre symétrique dédiée avec sécurité de niveau entreprise et zéro zone morte dans tous les espaces.' },
    { icon:'lock_open',       title:'Accès 24/7',           desc:'Votre workflow ne s\'arrête pas à 17h. Les membres profitent d\'un accès biométrique en continu.' },
    { icon:'concierge',       title:'Conciergerie',         desc:'Équipe sur place pour gérer vos livraisons, invités et besoins administratifs avec précision.' },
    { icon:'meeting_room',    title:'Salles de Réunion',    desc:'Salles équipées de projecteurs 4K, tableaux blancs interactifs et systèmes de visioconférence.' },
    { icon:'local_cafe',      title:'Café & Détente',       desc:'Espace lounge avec café de spécialité illimité, cuisine équipée et terrasse végétalisée.' },
    { icon:'print',           title:'Équipements Pros',     desc:'Imprimantes A3 couleur, scanners, casiers sécurisés et adresse postale professionnelle.' },
  ];

  const plans = [
    {
      badge:'Journalier', title:'Pass Jour', price:'25 DT', period:'/ jour',
      desc:'Idéal pour un besoin ponctuel ou pour découvrir l\'espace.',
      features:['Espace ouvert flex','Wi-Fi illimité','Café offert','Casier journalier','Impression 10 pages'],
      cta:'Réserver maintenant', ctaTo:'/register', highlighted:false,
    },
    {
      badge:'⭐ Le plus populaire', title:'Abonnement Mensuel', price:'350 DT', period:'/ mois',
      desc:'La formule préférée de nos membres réguliers.',
      features:['Accès illimité 24/7','Bureau dédié ou flex','Salles de réunion 10h/mois','Adresse postale','Impression 100 pages','Café & snacks illimités'],
      cta:'Commencer aujourd\'hui', ctaTo:'/register', highlighted:true,
    },
    {
      badge:'Équipe', title:'Plan Entreprise', price:'Sur devis', period:'',
      desc:'Pour les équipes de 5 personnes et plus.',
      features:['Bureaux privatifs','Réunions illimitées','Support dédié','Facturation mensuelle','Multi-sites','Espace personnalisé'],
      cta:'Contactez-nous', ctaTo:'#contact', highlighted:false,
    },
  ];

  const testimonials = [
    { quote:'Travailler chez Encre & Cobalt a transformé ma productivité. L\'ambiance, les équipements et l\'équipe sont au top. Je ne pourrais plus m\'en passer.', name:'Sarra Ben Amor', role:'CEO · TechStart Tunis', initial:'S' },
    { quote:'La meilleure décision pour notre équipe. Espaces flexibles, accès 24/7 et une communauté de professionnels motivants au quotidien.', name:'Mehdi Karoui', role:'CTO · DevFactory', initial:'M' },
    { quote:'Un coworking qui comprend vraiment les freelances. Tarifs clairs, atmosphère calme et un service client irréprochable.', name:'Nadia Ferchichi', role:'Designer UX · Freelance', initial:'N' },
  ];

  return (
    <>
      {/* ── Styles globaux ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap');

        html { scroll-behavior:smooth; scroll-padding-top:80px; }
        body { font-family:'Inter',sans-serif; background-color:#fbf9fb; color:#1b1b1e; }
        .sora { font-family:'Sora',sans-serif !important; }

        /* NAV — styles gérés dans Navbar.jsx */

        /* HERO */
        .hero-wrap { background:linear-gradient(155deg,#fbf9fb 0%,#eef3ff 55%,#e4ecff 100%); min-height:92vh; display:flex; align-items:center; padding-top:90px; position:relative; overflow:hidden; }
        .hero-blob { position:absolute; border-radius:50%; filter:blur(80px); opacity:.22; pointer-events:none; }
        .hero-img { border-radius:22px; overflow:hidden; box-shadow:0 28px 70px rgba(0,13,35,.2); transform:rotate(1.5deg); transition:transform .5s; }
        .hero-img:hover { transform:rotate(0deg); }
        .live-badge {
          position:absolute; bottom:-18px; left:-18px;
          background:rgba(255,255,255,.97); backdrop-filter:blur(12px);
          border-radius:16px; padding:14px 18px; min-width:220px;
          box-shadow:0 8px 28px rgba(0,13,35,.14); border:1.5px solid rgba(0,84,203,.1);
          display:flex; align-items:center; gap:12px;
          animation:float 4s ease-in-out infinite;
        }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        .live-dot { width:10px; height:10px; border-radius:50%; background:#2fbe8f; animation:pulse 2s infinite; flex-shrink:0; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(47,190,143,.45)} 50%{box-shadow:0 0 0 8px rgba(47,190,143,0)} }

        /* TRUST */
        .trust-bar { background:#dae2ff; border-top:1px solid rgba(0,84,203,.12); border-bottom:1px solid rgba(0,84,203,.12); }
        .trust-name { font-family:'Sora',sans-serif; font-weight:700; font-size:1.05rem; color:#000d23; opacity:.5; transition:opacity .2s; cursor:default; }
        .trust-name:hover { opacity:1; }

        /* KPI */
        .kpi-strip { background:#000d23; }

        /* SECTION BADGE */
        .sec-badge { display:inline-block; background:#dae2ff; color:#001847; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:6px 18px; border-radius:100px; margin-bottom:1rem; }
        .sec-badge.inv { background:rgba(218,226,255,.12); color:#b1c5ff; }

        /* SPACES */
        .space-card { position:relative; border-radius:20px; overflow:hidden; cursor:pointer; }
        .space-card img { width:100%; height:100%; object-fit:cover; transition:transform .6s ease; display:block; }
        .space-card:hover img { transform:scale(1.06); }
        .space-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,13,35,.92) 0%,transparent 65%); }
        .space-body { position:absolute; bottom:0; left:0; right:0; padding:1.5rem; }

        /* CTA SECTION */
        .cta-sec { background:linear-gradient(135deg,#000d23 0%,#0a1f45 100%); position:relative; overflow:hidden; }
        .cta-grid { position:absolute; inset:0; background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,.05) 1px,transparent 0); background-size:40px 40px; }

        /* CONTACT */
        .ec-input { width:100%; border:1.5px solid #c5c6ce; border-radius:12px; padding:13px 16px; font-size:.9rem; font-family:'Inter',sans-serif; background:#fff; color:#1b1b1e; transition:border-color .2s,box-shadow .2s; }
        .ec-input:focus { outline:none; border-color:#0054cb; box-shadow:0 0 0 4px rgba(0,84,203,.1); }
        .ec-input::placeholder { color:#9ea0a6; }

        /* FOOTER */
        .ec-footer { background:#000d23; }
        .ec-footer a { color:#798bac; text-decoration:none; font-size:.875rem; transition:color .2s; }
        .ec-footer a:hover { color:#dae2ff; }
        .soc-btn { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.08); display:inline-flex; align-items:center; justify-content:center; color:#798bac; text-decoration:none; transition:all .2s; margin-right:8px; }
        .soc-btn:hover { background:#0054cb; color:white; }

        /* ANIMATIONS */
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .fa { animation:fadeUp .75s ease both; }
        .fa-1 { animation-delay:.12s; }
        .fa-2 { animation-delay:.24s; }

        @media(max-width:767px) {
          .hero-wrap { min-height:auto; padding:100px 0 60px; }
          .live-badge { display:none !important; }
          .hero-right { display:none !important; }
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <Navbar session={session} />

      {/* ══ HERO ══ */}
      <section className="hero-wrap">
        <div className="hero-blob" style={{ width:500, height:500, background:EC.cobalt, top:-150, right:-80 }} />
        <div className="hero-blob" style={{ width:300, height:300, background:'#c4d4ff', bottom:-60, left:-100 }} />
        <div className="container">
          <div className="row align-items-center g-5">
            {/* Left */}
            <div className="col-lg-6">
              <span className="sec-badge fa">✦ Coworking Premium · Tunis</span>
              <h1 className="sora fw-bold fa fa-1 mb-4" style={{ fontSize:'clamp(2.3rem,5vw,3.4rem)', color:EC.navy, lineHeight:1.17, letterSpacing:'-.025em' }}>
                Réservez votre espace idéal en{' '}
                <span style={{ color:EC.cobalt }}>3 clics</span>
              </h1>
              <p className="fa fa-2 mb-4" style={{ color:EC.muted, fontSize:'1.1rem', lineHeight:1.8, maxWidth:520 }}>
                Encre &amp; Cobalt offre des espaces de travail conçus pour les professionnels ambitieux.
                Rejoignez une communauté d'excellence au cœur de Tunis.
              </p>

              {/* social proof */}
              <div className="d-flex align-items-center gap-3 mb-4 fa fa-2">
                <div className="d-flex">
                  {['S','M','N','K'].map((l,i) => (
                    <div key={i} style={{ width:34, height:34, borderRadius:'50%', background:i%2===0?EC.cobaltLight:EC.cobalt, color:i%2===0?EC.cobalt:EC.white, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.78rem', marginLeft:i>0?-8:0, border:'2px solid white' }}>{l}</div>
                  ))}
                </div>
                <p className="mb-0" style={{ color:EC.muted, fontSize:'.88rem' }}>
                  <strong style={{color:EC.navy}}>+200 membres</strong> nous font confiance
                </p>
              </div>

              <div className="d-flex flex-wrap gap-3 fa fa-2">
                <Link to={session ? '/dashboard' : '/register'} className="btn d-inline-flex align-items-center gap-2"
                  style={{ backgroundColor:EC.cobalt, color:'white', borderRadius:12, padding:'13px 30px', fontWeight:700, border:'none', fontSize:'1rem', transition:'all .25s' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,84,203,.35)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
                  <span className="material-symbols-outlined" style={{fontSize:20}}>event_available</span>
                  {session ? 'Accéder au Portail' : 'Réserver sans compte'}
                </Link>
                <Link to="/register" className="btn d-inline-flex align-items-center gap-2"
                  style={{ backgroundColor:'transparent', color:EC.navy, border:`2px solid ${EC.navyMid}`, borderRadius:12, padding:'13px 30px', fontWeight:700, fontSize:'1rem', transition:'all .25s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background=EC.navy;e.currentTarget.style.color='white';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=EC.navy;}}>
                  Devenir membre
                  <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Right */}
            <div className="col-lg-6 position-relative hero-right">
              <div className="hero-img">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCVxReLMTSMnl6dGnhZC8U2cLeyd7FtFsetmMaUKMaoAceHh7a0kXW5dNxnZeMDJTD0ZC7EU0xtx3pylkcAPy228LQE7bNxpOgM7o7sglIcWvOrD4dca-cPLOkMKvWJc1Ce1j7YaS05HV7qQaimKxnHRqFXnbPbh_1y7ZBZsbltE2xFSrnXrBROVuMdwtQro7QM3Xm0iqu7sCNpt1zft2wOC61tQP8-JVp8GuSj1IhhcBsWfdILcYdrB0L7VzyRgtZKELpt8iCR7Y"
                  alt="Espace de coworking Encre & Cobalt"
                  style={{ width:'100%', height:430, objectFit:'cover', display:'block' }}
                />
              </div>
              {/* Live badge */}
              <div className="live-badge">
                <div style={{ width:42, height:42, borderRadius:12, background:EC.cobalt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span className="material-symbols-outlined" style={{color:'white',fontSize:22}}>bolt</span>
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <div className="live-dot" />
                    <span style={{fontSize:'.75rem',fontWeight:700,color:EC.navy}}>Disponibilité en direct</span>
                  </div>
                  <p className="mb-0" style={{fontSize:'.75rem',color:EC.muted}}>15 postes libres maintenant</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TRUST BAR ══ */}
      <section className="trust-bar py-4">
        <div className="container">
          <p className="text-center mb-3" style={{color:EC.cobalt,fontSize:'.7rem',fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase'}}>
            Ils nous font confiance
          </p>
          <div className="d-flex flex-wrap justify-content-center align-items-center gap-5">
            {['BFI Group','InnoVision','DevFactory','PixelStudio','NovaTech'].map(b => (
              <div key={b} className="trust-name">{b}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ KPI STRIP ══ */}
      <section className="kpi-strip py-5">
        <div className="container">
          <div className="row g-4 justify-content-center">
            {[{value:200,suffix:'+',label:'Membres actifs'},{value:12,suffix:'',label:'Espaces disponibles'},{value:98,suffix:'%',label:'Taux de satisfaction'},{value:3,suffix:'+',label:"Années d'expérience"}].map((k,i)=>(
              <div key={i} className="col-6 col-md-3">
                <KpiCounter {...k} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AVANTAGES ══ */}
      <section id="avantages" className="py-5" style={{backgroundColor:EC.bgLow}}>
        <div className="container py-4">
          <div className="row mb-5">
            <div className="col-lg-7">
              <span className="sec-badge">Nos atouts</span>
              <h2 className="sora fw-bold mb-3" style={{color:EC.navy,fontSize:'clamp(1.8rem,3vw,2.4rem)',letterSpacing:'-.02em'}}>
                Le Standard Encre &amp; Cobalt
              </h2>
              <p style={{color:EC.muted,fontSize:'1.05rem',lineHeight:1.8}}>
                Nous avons éliminé tous les points de friction entre vous et votre meilleur travail.
                Des équipements premium conçus pour maximiser votre concentration et créativité.
              </p>
            </div>
          </div>
          <div className="row g-4">
            {features.map((f,i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ══ ESPACES ══ */}
      <section id="espaces" className="py-5" style={{backgroundColor:EC.navy}}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge inv">Nos espaces</span>
            <h2 className="sora fw-bold text-white mb-3" style={{fontSize:'clamp(1.8rem,3vw,2.4rem)'}}>
              Espaces Signature
            </h2>
            <p style={{color:EC.onNavy,maxWidth:560,margin:'0 auto',lineHeight:1.8}}>
              L'environnement façonne le résultat. Choisissez la configuration architecturale qui correspond à votre état d'esprit.
            </p>
          </div>
          <div className="row g-4">
            {/* Grande carte */}
            <div className="col-lg-8">
              <div className="space-card" style={{height:480}}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAK2IhBFMr9iRfeyjL932e_-BDpfhpsjbHAAmsMYP8pWVUompUswy9nLWNu1o8igTnSVoUootv062bdc-CNDkBhYvX5tqM-ZT1TMTsxQz5FA-wV0IsV--_0Afumhh2_F_bka0hjVsfjkBC7XcOLsDbe0X7D7h9iue35kjtQUhym4ZTkcdwd0mXRfSGGGz60KN0i1CsPjLxlHF0BB0FlK0zXQZ52J80iS80hZcdIbC7jVomseVARgyWZdgRPZXCWgfq5XvQrgH61lzg"
                  alt="L'Atrium Central" />
                <div className="space-overlay" />
                <div className="space-body">
                  <span style={{backgroundColor:EC.cobalt,color:'white',borderRadius:8,padding:'4px 12px',fontSize:'.72rem',fontWeight:700,display:'inline-block',marginBottom:8}}>⭐ Espace Principal</span>
                  <h3 className="sora fw-bold text-white mb-2">L'Atrium Central</h3>
                  <p className="mb-0" style={{color:EC.onNavy,fontSize:'.9rem',maxWidth:460}}>Notre joyau — architecture grandiose, tables communales en noyer massif et la plus haute densité d'opportunités de networking.</p>
                </div>
              </div>
            </div>
            {/* Colonne droite */}
            <div className="col-lg-4">
              <div className="d-flex flex-column gap-4 h-100">
                <div className="space-card flex-fill" style={{minHeight:225}}>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAh3ZCgUrYvYQe_u32LptrkK0S4KXhXRjfpjtzctnEaG_PU6SJ7n1APuqbz9AvKarYYX8pG0MeW7kIUtWoZee34oTbSioQxnSF8yFYxVVBFz65gjXxP07ZobPhQtzzbG4SLqpf4Ji6ONLKl4wyCu2vf2daiaRIvURuOZs46Pe7C_mtZfGsS4jwkJNpF0rrlARiQIQSGbuk9FtMfOFh9DMmp4pTGnm_ZGs-dlOLo11qYLVVlobPee-oy94DUNgyOa8CLkSlqJugo8Q"
                    alt="Espaces Tech" />
                  <div className="space-overlay" />
                  <div className="space-body">
                    <h5 className="sora fw-bold text-white mb-1">Espaces Tech</h5>
                    <p className="mb-0" style={{color:EC.onNavy,fontSize:'.82rem'}}>Setups dual-moniteur et équipement ergonomique haut de gamme.</p>
                  </div>
                </div>
                <div className="space-card flex-fill" style={{minHeight:225}}>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJrwAgC1-jOW-IV6zwN0Kp0DWkRiWOFEgSE-5UnOoUr_eG8dQXY0mqsXlSOK_0VCbhDb9x4OAyJb2GqMsy8MShSgjz4jk5D01_gx6Ry8cimT_Xoxmo2dvGIcW5u6cWW45pGBBY0xXZ51jcCguVlZWE2l_QV-SubTyIKtN56jmKlq03jEN3ULOpg3BeXA4EyYyCT0dzzPzGbDrZrRfmRM7HY1cx10WXX43WWEySbJkwZyjHMn_14iPlmVHRdnI8Y2o6pUg24YxqcfI"
                    alt="Pods de Focus" />
                  <div className="space-overlay" />
                  <div className="space-body">
                    <h5 className="sora fw-bold text-white mb-1">Pods de Focus</h5>
                    <p className="mb-0" style={{color:EC.onNavy,fontSize:'.82rem'}}>Capsules acoustiques pour concentration maximale et travail approfondi.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TARIFS ══ */}
      <section id="tarifs" className="py-5" style={{backgroundColor:EC.bgLow}}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge">Tarifs Transparents</span>
            <h2 className="sora fw-bold mb-3" style={{color:EC.navy,fontSize:'clamp(1.8rem,3vw,2.4rem)'}}>
              Choisissez votre formule
            </h2>
            <p style={{color:EC.muted,maxWidth:480,margin:'0 auto'}}>
              Pas de frais cachés. Pas de mauvaises surprises. Juste de la productivité pure.
            </p>
          </div>
          <div className="row g-4 align-items-stretch">
            {plans.map((p,i) => <PricingCard key={i} {...p} />)}
          </div>
        </div>
      </section>

      {/* ══ TÉMOIGNAGES ══ */}
      <section id="temoignages" className="py-5" style={{backgroundColor:EC.bg}}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="sec-badge">Témoignages</span>
            <h2 className="sora fw-bold mb-3" style={{color:EC.navy,fontSize:'clamp(1.8rem,3vw,2.4rem)'}}>
              Ils adorent Encre &amp; Cobalt
            </h2>
          </div>
          <div className="row g-4">
            {testimonials.map((t,i) => <TestiCard key={i} {...t} />)}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="cta-sec py-5">
        <div className="cta-grid" />
        <div className="container py-5 position-relative text-center">
          <span className="sec-badge inv">Passez à l'action</span>
          <h2 className="sora fw-bold text-white mb-4" style={{fontSize:'clamp(2rem,4vw,3rem)',maxWidth:620,margin:'0 auto 1rem'}}>
            Prêt à faire votre meilleur travail ?
          </h2>
          <p className="mb-5" style={{color:EC.onNavy,maxWidth:500,margin:'0 auto 2.5rem',lineHeight:1.8}}>
            Vivez la différence Encre &amp; Cobalt avec un pass journalier ou un abonnement complet.
            Rejoignez +200 professionnels qui ont choisi l'excellence.
          </p>
          <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
            <Link to={session ? '/dashboard' : '/register'} className="btn d-inline-flex align-items-center gap-2"
              style={{backgroundColor:EC.cobalt,color:'white',borderRadius:12,padding:'15px 36px',fontWeight:700,border:'none',fontSize:'1rem',transition:'all .25s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,84,203,.4)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
              <span className="material-symbols-outlined" style={{fontSize:20}}>event_available</span>
              Réserver un Pass Jour
            </Link>
            <Link to="/register" className="btn d-inline-flex align-items-center gap-2"
              style={{backgroundColor:'transparent',color:'white',border:'2px solid rgba(255,255,255,.3)',borderRadius:12,padding:'15px 36px',fontWeight:700,fontSize:'1rem',transition:'all .25s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='white'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.3)'}>
              <span className="material-symbols-outlined" style={{fontSize:20}}>person_add</span>
              Devenir Membre
            </Link>
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section id="contact" className="py-5" style={{backgroundColor:EC.bg}}>
        <div className="container py-4">
          <div className="row g-5 align-items-start">
            <div className="col-lg-5">
              <span className="sec-badge">Contact</span>
              <h2 className="sora fw-bold mb-4" style={{color:EC.navy,fontSize:'clamp(1.8rem,3vw,2.2rem)'}}>
                Venez nous rendre visite
              </h2>
              <div className="d-flex flex-column gap-4">
                {[
                  {icon:'location_on', label:'Adresse',    val:'Avenue Habib Bourguiba, Tunis 1001, Tunisie'},
                  {icon:'phone',       label:'Téléphone',  val:'+216 71 XXX XXX'},
                  {icon:'mail',        label:'Email',      val:'bonjour@encrecobalt.tn'},
                  {icon:'schedule',    label:'Horaires',   val:'Lun–Ven 7h–22h · Week-end 9h–18h'},
                ].map(({icon,label,val})=>(
                  <div key={icon} className="d-flex gap-3 align-items-start">
                    <div style={{width:46,height:46,borderRadius:13,background:EC.cobaltLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span className="material-symbols-outlined" style={{color:EC.cobalt,fontSize:22}}>{icon}</span>
                    </div>
                    <div>
                      <div style={{fontSize:'.72rem',fontWeight:700,color:EC.muted,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>{label}</div>
                      <div style={{color:EC.navy,fontWeight:500}}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-lg-7">
              <div style={{backgroundColor:EC.white,borderRadius:24,padding:'2.5rem',boxShadow:'0 8px 32px rgba(0,13,35,.08)',border:`1.5px solid ${EC.outline}`}}>
                <h4 className="sora fw-bold mb-4" style={{color:EC.navy}}>Envoyez-nous un message</h4>
                <form onSubmit={e=>e.preventDefault()}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="fw-semibold mb-2 d-block" style={{color:EC.navy,fontSize:'.875rem'}}>Prénom &amp; Nom</label>
                      <input type="text" className="ec-input" placeholder="Votre nom complet" />
                    </div>
                    <div className="col-md-6">
                      <label className="fw-semibold mb-2 d-block" style={{color:EC.navy,fontSize:'.875rem'}}>Email</label>
                      <input type="email" className="ec-input" placeholder="votre@email.com" />
                    </div>
                    <div className="col-12">
                      <label className="fw-semibold mb-2 d-block" style={{color:EC.navy,fontSize:'.875rem'}}>Sujet</label>
                      <select className="ec-input">
                        <option value="">Choisir un sujet…</option>
                        <option>Visite de l'espace</option>
                        <option>Abonnement mensuel</option>
                        <option>Solution entreprise</option>
                        <option>Autre demande</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="fw-semibold mb-2 d-block" style={{color:EC.navy,fontSize:'.875rem'}}>Message</label>
                      <textarea className="ec-input" rows={4} placeholder="Décrivez votre besoin…" style={{resize:'vertical'}} />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                        style={{backgroundColor:EC.cobalt,color:'white',borderRadius:12,padding:'14px',fontWeight:700,border:'none',fontSize:'1rem',transition:'all .25s'}}
                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,84,203,.3)';}}
                        onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
                        <span className="material-symbols-outlined" style={{fontSize:20}}>send</span>
                        Envoyer le message
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="ec-footer pt-5 pb-4">
        <div className="container">
          <div className="row g-4 mb-5">
            <div className="col-lg-4 col-md-6">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${EC.navyMid},${EC.cobalt})`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span className="material-symbols-outlined" style={{color:'white',fontSize:18}}>hub</span>
                </div>
                <span className="sora fw-bold" style={{color:EC.white,fontSize:'1.1rem'}}>Encre &amp; Cobalt</span>
              </div>
              <p style={{color:EC.onNavy,fontSize:'.875rem',lineHeight:1.8,maxWidth:300}}>
                Espaces de travail premium pour les professionnels modernes. Situé au cœur de Tunis depuis 2021.
              </p>
              <div className="mt-3">
                {['public','alternate_email','chat'].map(icon => (
                  <a key={icon} href="#" className="soc-btn">
                    <span className="material-symbols-outlined" style={{fontSize:18}}>{icon}</span>
                  </a>
                ))}
              </div>
            </div>

            {[
              {title:'Explorer', links:['Trouver un espace','Réunions & Événements','Plans Membres','Solutions Entreprises']},
              {title:'Société',  links:['À propos','Carrières','Blog','Réseau Partenaires']},
              {title:'Légal',   links:["Politique de confidentialité","Conditions d'utilisation",'Cookies','Plan du site']},
            ].map(({title,links})=>(
              <div key={title} className="col-lg-2 col-md-3 col-6">
                <h6 className="fw-bold mb-3" style={{color:EC.white,fontSize:'.8rem',textTransform:'uppercase',letterSpacing:'.07em'}}>{title}</h6>
                <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                  {links.map(l=><li key={l}><a href="#">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>

          <hr style={{borderColor:'rgba(255,255,255,.08)',margin:0}} />
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center pt-4 gap-2">
            <p className="mb-0" style={{color:EC.onNavy,fontSize:'.8rem'}}>
              © {new Date().getFullYear()} Encre &amp; Cobalt Coworking. Tous droits réservés.
            </p>
            <p className="mb-0" style={{color:EC.onNavy,fontSize:'.8rem'}}>
              Conçu avec <span style={{color:EC.cobaltDim}}>♥</span> à Tunis
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
