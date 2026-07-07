import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

const NAV_LINKS = [
  { href: '#espaces', label: 'Espaces' },
  { href: '#avantages', label: 'Avantages' },
  { href: '#offres', label: 'Offres' },
];

const ESPACES = [
  {
    icon: 'groups',
    title: 'Open Space',
    desc: 'Postes partagés flexibles, réservation par créneau ou à la journée.',
    tag: 'Populaire',
  },
  {
    icon: 'door_sliding',
    title: 'Bureau privé',
    desc: 'Suites fermées pour équipes de 4 à 6 personnes, abonnement mensuel.',
    tag: 'Premium',
  },
  {
    icon: 'meeting_room',
    title: 'Salles de réunion',
    desc: 'Atlas & Sahel — équipées pour vos réunions clients et workshops.',
    tag: 'À l\'heure',
  },
  {
    icon: 'school',
    title: 'Formation',
    desc: 'Grand amphi modulable pour sessions, formations et événements.',
    tag: 'Sur demande',
  },
];

const AVANTAGES = [
  {
    icon: 'wifi',
    title: 'Fibre gigabit',
    desc: 'Connexion symétrique sécurisée, zéro zone morte dans tout l\'espace.',
  },
  {
    icon: 'schedule',
    title: 'Accès 24h/24',
    desc: 'Travaillez selon votre rythme, sans contrainte horaire.',
  },
  {
    icon: 'support_agent',
    title: 'Accueil & support',
    desc: 'Équipe sur place pour check-in, invités et assistance quotidienne.',
  },
  {
    icon: 'verified_user',
    title: 'Portail membre',
    desc: 'Profil, abonnement et réservations centralisés en un seul endroit.',
  },
];

const OFFRES = [
  { type: 'Day Pass', price: 'À partir de 35 DT', detail: '1 journée · accès open space' },
  { type: 'Mensuel', price: 'Sur devis', detail: '30 jours · renouvellement optionnel', highlight: true },
  { type: 'Annuel', price: 'Sur devis', detail: '365 jours · tarif entreprise' },
];

export default function Landing({ session }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-on-background selection:bg-secondary-fixed selection:text-on-secondary-fixed overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full bg-secondary/8 blur-[100px]" />
        <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-primary/6 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,13,35,0.06) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <header className="fixed top-0 w-full z-50 border-b border-outline-variant/15 bg-white/90 backdrop-blur-md">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-3 md:py-4 max-w-container-max mx-auto gap-sm">
          <BrandLogo to="/" />

          <nav className="hidden md:flex items-center gap-lg">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-inter text-body-md text-on-surface-variant hover:text-secondary transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-sm">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-primary hover:bg-surface-container-high"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
            </button>

            {session ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline font-inter font-semibold text-label-md text-primary px-sm py-2 hover:bg-surface-container-high rounded-lg transition-colors"
                >
                  Mon portail
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex bg-primary text-white px-md py-2.5 rounded-lg font-inter font-semibold text-label-md hover:bg-primary-container transition-all"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline font-inter font-semibold text-label-md text-primary px-sm py-2 hover:bg-surface-container-high rounded-lg transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="bg-secondary text-on-secondary px-3 sm:px-md py-2.5 rounded-lg font-inter font-semibold text-label-sm sm:text-label-md hover:bg-secondary-container shadow-md transition-all"
                >
                  <span className="hidden sm:inline">Devenir membre</span>
                  <span className="sm:hidden">Rejoindre</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-outline-variant/15 bg-white px-margin-mobile py-md animate-[fadeUp_0.25s_ease-out]">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="font-inter font-semibold text-body-md text-primary py-3 px-3 rounded-lg hover:bg-surface-container-low"
                >
                  {item.label}
                </a>
              ))}
              {session ? (
                <>
                  <Link to="/dashboard" onClick={closeMenu} className="font-inter font-semibold text-body-md text-primary py-3 px-3 rounded-lg hover:bg-surface-container-low">
                    Mon portail
                  </Link>
                  <button type="button" onClick={() => { closeMenu(); handleLogout(); }} className="text-left font-inter font-semibold text-body-md text-error py-3 px-3">
                    Déconnexion
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={closeMenu} className="font-inter font-semibold text-body-md text-secondary py-3 px-3">
                  Connexion
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative pt-24 pb-xl md:pt-36 md:pb-32 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-xl items-center">
            <div className="lg:col-span-6 space-y-md order-2 lg:order-1 min-w-0 w-full">
              <div className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed px-4 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-[16px] filled">location_on</span>
                <span className="font-inter text-label-sm font-semibold uppercase tracking-wider">
                  Pilote 33S · VC LOW
                </span>
              </div>

              <h1 className="font-sora text-[2rem] sm:text-[2.5rem] md:text-headline-xl text-primary leading-[1.12] tracking-tight">
                Votre espace de travail,{' '}
                <span className="text-secondary">réinventé.</span>
              </h1>

              <p className="font-inter text-body-md sm:text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
                Encre &amp; Cobalt réunit open space, bureaux privés et salles de réunion dans un écosystème digital pensé pour entrepreneurs, freelances et équipes en croissance.
              </p>

              <div className="flex flex-col xs:flex-row flex-wrap gap-sm pt-sm">
                <Link
                  to={session ? '/dashboard' : '/register'}
                  className="inline-flex justify-center items-center gap-2 bg-secondary text-on-secondary px-lg py-3.5 rounded-xl font-inter font-semibold text-label-md shadow-lg shadow-secondary/20 hover:bg-secondary-container transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                  {session ? 'Accéder au portail' : 'Créer mon compte'}
                </Link>
                <a
                  href="#espaces"
                  className="inline-flex justify-center items-center gap-2 border-2 border-primary/15 bg-white text-primary px-lg py-3.5 rounded-xl font-inter font-semibold text-label-md hover:border-secondary/30 transition-all"
                >
                  Découvrir les espaces
                  <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                </a>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-sm pt-md max-w-lg">
                {[
                  { value: '7+', label: 'Espaces' },
                  { value: '24/7', label: 'Accès' },
                  { value: '3 clics', label: 'Réservation' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl p-2 sm:p-sm border border-outline-variant/15 custom-shadow text-center">
                    <p className="font-sora text-base sm:text-headline-sm text-secondary font-bold">{stat.value}</p>
                    <p className="font-inter text-[11px] sm:text-label-sm text-on-surface-variant">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 min-w-0 w-full space-y-4 lg:space-y-0 lg:relative lg:pb-8">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/15 aspect-[16/10] sm:aspect-[4/3] w-full">
                <img
                  className="w-full h-full object-cover"
                  alt="Espace coworking Encre et Cobalt"
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 via-transparent to-transparent" />
                <div className="hidden lg:block absolute top-4 right-4 bg-primary text-white px-4 py-2 rounded-xl custom-shadow">
                  <p className="font-inter text-label-sm font-semibold">Wi-Fi fibre · Café · Impression</p>
                </div>
              </div>

              <div className="glass-card p-md rounded-2xl custom-shadow w-full lg:absolute lg:-bottom-6 lg:left-4 xl:-left-8 lg:max-w-[260px]">
                <div className="flex items-center gap-sm">
                  <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center text-white shrink-0">
                    <span className="material-symbols-outlined filled">event_available</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-inter font-semibold text-label-md text-primary">Disponibilité live</p>
                    <p className="font-inter text-body-sm text-on-surface-variant">Open Space Central · places libres</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-lg border-y border-outline-variant/15 bg-white/70 backdrop-blur-sm">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex flex-col md:flex-row items-center justify-between gap-md text-center md:text-left">
              <p className="font-inter text-label-sm uppercase tracking-[0.15em] text-on-surface-variant">
                Solution VC LOW · Gestion coworking sur mesure
              </p>
              <div className="flex flex-wrap justify-center gap-md md:gap-lg text-on-surface-variant">
                {['Membres & abonnements', 'Réservations', 'Portail digital'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5 font-inter text-body-sm">
                    <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="avantages" className="scroll-mt-24 py-xl px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-xl">
            <span className="font-inter text-label-sm font-semibold text-secondary uppercase tracking-widest">Pourquoi nous choisir</span>
            <h2 className="font-sora text-headline-lg text-primary mt-sm mb-md">L&apos;expérience Encre &amp; Cobalt</h2>
            <p className="font-inter text-body-md text-on-surface-variant">
              Un environnement conçu pour éliminer les frictions et vous laisser vous concentrer sur l&apos;essentiel.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {AVANTAGES.map((item) => (
              <article
                key={item.title}
                className="group bg-white rounded-2xl p-lg border border-outline-variant/10 custom-shadow hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center mb-md group-hover:bg-secondary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <h3 className="font-sora text-headline-sm text-primary mb-xs">{item.title}</h3>
                <p className="font-inter text-body-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="espaces" className="scroll-mt-24 py-xl bg-primary text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-secondary rounded-full blur-[120px]" />
          </div>

          <div className="relative max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="mb-xl max-w-3xl">
              <span className="font-inter text-label-sm font-semibold text-secondary-fixed uppercase tracking-widest">Nos espaces</span>
              <h2 className="font-sora text-headline-lg text-white mt-sm">Un lieu pour chaque façon de travailler</h2>
              <p className="font-inter text-body-md text-on-primary-container mt-md">
                Open space, bureaux privés, salles de réunion et amphi de formation — tarification flexible à l&apos;heure ou à l&apos;abonnement.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {ESPACES.map((space) => (
                <article
                  key={space.title}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-lg hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex justify-between items-start mb-md gap-2">
                    <span className="material-symbols-outlined text-secondary-fixed text-[28px]">{space.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary/30 text-white px-2 py-1 rounded-full shrink-0">
                      {space.tag}
                    </span>
                  </div>
                  <h3 className="font-sora text-headline-sm text-white mb-xs">{space.title}</h3>
                  <p className="font-inter text-body-sm text-on-primary-container leading-relaxed">{space.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="offres" className="scroll-mt-24 py-xl px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="text-center mb-xl">
            <span className="font-inter text-label-sm font-semibold text-secondary uppercase tracking-widest">Tarification</span>
            <h2 className="font-sora text-headline-lg text-primary mt-sm mb-md">Des formules adaptées à votre rythme</h2>
            <p className="font-inter text-body-md text-on-surface-variant max-w-xl mx-auto">
              Day pass, abonnement mensuel ou annuel — choisissez la formule qui correspond à votre activité.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-gutter max-w-4xl mx-auto">
            {OFFRES.map((offre) => (
              <div
                key={offre.type}
                className={`rounded-2xl p-lg border transition-all ${
                  offre.highlight
                    ? 'bg-primary text-white border-primary custom-shadow md:scale-[1.03] shadow-xl ring-2 ring-secondary/30'
                    : 'bg-white border-outline-variant/15 custom-shadow hover:border-secondary/30'
                }`}
              >
                {offre.highlight && (
                  <span className="inline-block mb-sm text-[10px] font-bold uppercase tracking-wider bg-secondary text-white px-2 py-1 rounded-full">
                    Recommandé
                  </span>
                )}
                <h3 className={`font-sora text-headline-sm mb-xs ${offre.highlight ? 'text-white' : 'text-primary'}`}>{offre.type}</h3>
                <p className={`font-sora text-headline-md font-bold mb-sm ${offre.highlight ? 'text-secondary-fixed' : 'text-secondary'}`}>
                  {offre.price}
                </p>
                <p className={`font-inter text-body-sm ${offre.highlight ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                  {offre.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-xl px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary-container to-primary p-8 md:p-16 text-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-[80px]" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="font-sora text-headline-lg text-white mb-md">Prêt à rejoindre Encre &amp; Cobalt ?</h2>
              <p className="font-inter text-body-md sm:text-body-lg text-on-primary-container mb-xl">
                Créez votre compte membre en quelques minutes et accédez à votre portail personnel.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-sm">
                <Link
                  to={session ? '/dashboard' : '/register'}
                  className="inline-flex justify-center items-center gap-2 bg-secondary text-on-secondary px-xl py-4 rounded-xl font-inter font-semibold text-label-md hover:bg-secondary-container shadow-lg transition-all active:scale-[0.98]"
                >
                  {session ? 'Ouvrir mon portail' : 'Commencer gratuitement'}
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex justify-center items-center gap-2 border border-white/25 text-white px-xl py-4 rounded-xl font-inter font-semibold text-label-md hover:bg-white/10 transition-all"
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-on-primary border-t border-white/5">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-md">
            <div className="text-center md:text-left">
              <p className="font-sora text-headline-sm text-white font-bold">Encre &amp; Cobalt</p>
              <p className="font-inter text-body-sm text-on-primary-container mt-1">Coworking · Propulsé par VC LOW</p>
            </div>
            <div className="flex flex-wrap justify-center gap-lg font-inter text-body-sm text-on-primary-container">
              <a href="mailto:contact@vclow.tn" className="hover:text-white transition-colors">contact@vclow.tn</a>
              <span className="hidden sm:inline">·</span>
              <span>Thirty Three Space</span>
            </div>
          </div>
          <p className="font-inter text-body-sm text-on-primary-container/70 text-center mt-lg pt-lg border-t border-white/10">
            © 2026 Encre &amp; Cobalt · VC LOW Coworking. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
