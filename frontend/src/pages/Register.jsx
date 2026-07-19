import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

/* ─── SVG Icons ─── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#0077B5"/>
    <path fill="white" d="M13 18h5v17h-5V18zm2.5-7a2.9 2.9 0 1 1 0 5.8A2.9 2.9 0 0 1 15.5 11zM21 18h4.8v2.3h.1c.7-1.3 2.3-2.7 4.7-2.7C35.7 17.6 37 20 37 24.3V35h-5v-9.7c0-2.3-.8-3.9-2.7-3.9-1.5 0-2.4 1-2.8 2-.1.4-.2.9-.2 1.4V35h-5V18z"/>
  </svg>
);

/* ─── Field composant réutilisable ─── */
function Field({ id, label, icon, type = 'text', value, onChange, placeholder, required = false, rightAddon }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
        </span>
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          className="form-input"
          style={rightAddon ? { paddingRight: 44 } : {}}
          placeholder={placeholder}
        />
        {rightAddon}
      </div>
    </div>
  );
}

export default function Register() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [nom, setNom]               = useState('');
  const [prenom, setPrenom]         = useState('');
  const [telephone, setTelephone]   = useState('');
  const [typeMembre, setTypeMembre] = useState('individuel');
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nom, prenom, telephone, role: 'member', type_membre: typeMembre },
        },
      });
      if (error) throw error;
      setSuccessMsg('Compte créé ! Vérifiez votre email ou connectez-vous directement.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setErrorMsg(error.message || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message || 'Erreur lors de la connexion sociale.');
    }
  };

  const memberTypes = [
    { value: 'individuel', label: 'Individuel', icon: 'person', desc: 'Freelance, consultant, indépendant' },
    { value: 'entreprise', label: 'Entreprise', icon: 'business', desc: 'Équipe ou société' },
    { value: 'etudiant',   label: 'Étudiant',   icon: 'school',  desc: 'Tarif réduit étudiant' },
  ];

  return (
    <div className="min-h-screen flex font-inter text-on-surface">

      {/* ══════════════════════════════════════════
          PANNEAU GAUCHE — Illustratif (desktop only)
          ══════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col justify-center shrink-0"
        aria-hidden="true"
        style={{
          width: '46%',
          minWidth: 340,
          padding: '32px 40px',
          background: 'linear-gradient(145deg, #000d23 0%, #10233f 50%, #0040a0 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blobs décoratifs */}
        <div style={{
          position: 'absolute', top: -80, right: -60,
          width: 350, height: 350, borderRadius: '50%', opacity: 0.15,
          background: 'radial-gradient(circle, #0054cb, transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -40,
          width: 280, height: 280, borderRadius: '50%', opacity: 0.1,
          background: 'radial-gradient(circle, #b5c7eb, transparent)',
          pointerEvents: 'none',
        }} />

        {/* Logo haut */}
        <div style={{ position: 'relative', zIndex: 10, marginBottom: '40px' }}>
          <BrandLogo to="/" light />
        </div>

        {/* Contenu central */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%' }} className="animate-fade-up">
          {/* Badge */}
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', borderRadius: 99,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              background: 'rgba(181,199,235,0.12)', color: '#b5c7eb',
              border: '1px solid rgba(181,199,235,0.18)',
              marginBottom: 12,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>star</span>
            Rejoindre la communauté
          </span>

          {/* Titre */}
          <h2
            className="font-sora"
            style={{ color: '#f0f4ff', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.18, marginBottom: 12 }}
          >
            Rejoignez<br/>
            <span style={{ color: '#b1c5ff' }}>l&apos;élite</span><br/>
            des workspace.
          </h2>

          {/* Description */}
          <p
            style={{
              color: 'rgba(181,199,235,0.78)',
              fontSize: 14, lineHeight: 1.6,
              marginBottom: 16,
              width: '100%',
              overflowWrap: 'break-word',
            }}
          >
            Créez votre profil membre et accédez à l&apos;ensemble de l&apos;écosystème Encre &amp; Cobalt.
          </p>

          {/* Avantages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: 'bolt',           text: 'Réservation en 3 clics' },
              { icon: 'qr_code_2',      text: 'QR Code d\'accès instantané' },
              { icon: 'notifications',  text: 'Alertes temps réel' },
              { icon: 'receipt_long',   text: 'Factures et historique complets' },
            ].map(({ icon, text }) => (
              <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)', color: '#b1c5ff',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                </span>
                <span style={{ color: 'rgba(214,227,255,0.82)', fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          PANNEAU DROIT — Formulaire
          ══════════════════════════════════════════ */}
      <div className="flex-1 page-gradient flex flex-col relative overflow-hidden">
        {/* Blobs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,84,203,0.07), transparent)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,13,35,0.05), transparent)' }} />

        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 relative z-10">
          <BrandLogo to="/" />
          <Link to="/login" className="text-secondary font-semibold text-sm hover:underline">
            Se connecter
          </Link>
        </header>

        {/* Formulaire */}
        <main className="flex-1 flex items-center justify-center px-6 py-2 relative z-10">
          <div className="w-full max-w-[520px] animate-fade-up">

            {/* En-tête */}
            <div className="text-center mb-2">
              <h1 className="font-sora text-2xl font-bold text-primary">
                Créer votre compte
              </h1>
            </div>

            {/* Messages */}
            {errorMsg && (
              <div className="mb-5 p-4 rounded-2xl flex items-center gap-3 text-sm animate-fade-in"
                style={{ background: '#ffdad6', color: '#93000a', border: '1px solid rgba(186,26,26,0.15)' }}>
                <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-5 p-4 rounded-2xl flex items-center gap-3 text-sm animate-fade-in"
                style={{ background: '#dae2ff', color: '#001847', border: '1px solid rgba(0,84,203,0.2)' }}>
                <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Card */}
            <div className="glass-card rounded-3xl shadow-elevated p-4 space-y-3">

              <form onSubmit={handleRegister} className="space-y-3">

                {/* Nom / Prénom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    id="reg-prenom" label="Prénom" icon="badge"
                    value={prenom} onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Jean" required
                  />
                  <Field
                    id="reg-nom" label="Nom" icon="person"
                    value={nom} onChange={(e) => setNom(e.target.value)}
                    placeholder="Dupont" required
                  />
                </div>

                {/* Email */}
                <Field
                  id="reg-email" label="Adresse email" icon="mail"
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@entreprise.com" required
                />

                {/* Téléphone */}
                <Field
                  id="reg-tel" label="Téléphone" icon="phone"
                  type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+216 99 999 999" required
                />

                {/* Type de membre */}
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor="reg-type">
                    Type de membre
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>card_membership</span>
                    </span>
                    <select
                      id="reg-type"
                      value={typeMembre}
                      onChange={(e) => setTypeMembre(e.target.value)}
                      className="form-input appearance-none"
                    >
                      {memberTypes.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mot de passe */}
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor="reg-password">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
                    </span>
                    <input
                      id="reg-password"
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                      style={{ paddingRight: 44 }}
                      placeholder="Minimum 8 caractères"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-secondary transition-colors"
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {showPwd ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                  style={{ padding: '8px 24px', borderRadius: 12 }}
                >
                  {loading
                    ? <><span className="animate-spin material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Création…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span> Créer mon compte</>
                  }
                </button>
              </form>

              {/* Séparateur */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-outline-variant/30" />
                <span className="text-[10px] text-on-surface-variant font-medium whitespace-nowrap">OU CONTINUER AVEC</span>
                <div className="flex-1 h-px bg-outline-variant/30" />
              </div>

              {/* Sociaux */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="flex items-center justify-center gap-2 px-4 py-1.5 bg-white border border-outline-variant/30 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-low hover:-translate-y-px transition-all active:scale-[0.97] shadow-sm"
                >
                  <GoogleIcon /> Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('linkedin_oidc')}
                  className="flex items-center justify-center gap-2 px-4 py-1.5 bg-white border border-outline-variant/30 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-low hover:-translate-y-px transition-all active:scale-[0.97] shadow-sm"
                >
                  <LinkedInIcon /> LinkedIn
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-on-surface-variant mt-3">
              Déjà inscrit ?{' '}
              <Link to="/login" className="text-secondary font-semibold hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </main>

        <footer className="relative z-10 text-center py-2 px-6">
          <p className="text-[10px] text-outline-variant">
            © {new Date().getFullYear()} Encre &amp; Cobalt · Tous droits réservés
          </p>
        </footer>
      </div>
    </div>
  );
}
