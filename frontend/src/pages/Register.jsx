import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ─── SVG Icons ─── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#0077B5" />
    <path fill="white" d="M13 18h5v17h-5V18zm2.5-7a2.9 2.9 0 1 1 0 5.8A2.9 2.9 0 0 1 15.5 11zM21 18h4.8v2.3h.1c.7-1.3 2.3-2.7 4.7-2.7C35.7 17.6 37 20 37 24.3V35h-5v-9.7c0-2.3-.8-3.9-2.7-3.9-1.5 0-2.4 1-2.8 2-.1.4-.2.9-.2 1.4V35h-5V18z" />
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

/* ─── Composant OTP : 6 cases ─── */
function OtpInput({ onComplete, loading, error, autoCode }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    // Focus sur la première case à l'affichage
    refs[0].current?.focus();
  }, []);

  useEffect(() => {
    if (autoCode && autoCode.length === 6) {
      const newDigits = autoCode.split('');
      setDigits(newDigits);
    }
  }, [autoCode]);

  const handleChange = (index, val) => {
    // N'accepter que les chiffres
    const digit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      // Avancer au suivant
      refs[index + 1].current?.focus();
    }

    // Dès que le 6e chiffre est saisi → soumettre automatiquement
    if (digit && index === 5) {
      const fullCode = [...newDigits.slice(0, 5), digit].join('');
      if (fullCode.length === 6) {
        onComplete(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) refs[index - 1].current?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs[index + 1].current?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((d, i) => { newDigits[i] = d; });
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    refs[focusIdx].current?.focus();
    if (pasted.length === 6) onComplete(pasted);
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '8px 0' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          id={`otp-digit-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={loading}
          style={{
            width: 52,
            height: 64,
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 800,
            borderRadius: 12,
            border: error
              ? '2px solid #ef4444'
              : d
                ? '2px solid #0040a0'
                : '2px solid #c7d8ff',
            background: d ? '#eef2ff' : '#f8faff',
            color: '#000d23',
            outline: 'none',
            transition: 'all 0.15s ease',
            cursor: loading ? 'not-allowed' : 'text',
            opacity: loading ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [typeMembre, setTypeMembre] = useState('individuel');
  const [role, setRole] = useState('member');
  const [specialite, setSpecialite] = useState('');
  const [biographie, setBiographie] = useState('');
  const [coworkingName, setCoworkingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── OTP ──
  const [step, setStep] = useState('form'); // 'form' | 'otp' | 'done'
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const navigate = useNavigate();

  // Countdown pour "Renvoyer"
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Étape 1 : Envoyer OTP ─────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    setEmail(cleanEmail);
    try {
      const res = await fetch(`${API_URL}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, prenom: prenom.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'envoi du code.');

      if (data.email) setEmail(data.email);
      setStep('otp');
      setResendTimer(60);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2 : Vérifier OTP + Créer le compte ─────────────────────────────
  const handleOtpComplete = async (code) => {
    setOtpLoading(true);
    setOtpError('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Vérifier le code OTP
      const verifyRes = await fetch(`${API_URL}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: code.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Code invalide.');

      // 2. Créer le compte Supabase Auth
      const userData = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        role,
        type_membre: ['formateur', 'admin'].includes(role) ? null : typeMembre,
      };
      if (role === 'formateur') {
        userData.specialite = specialite;
        userData.biographie = biographie;
      }
      if (role === 'admin') {
        userData.coworking_name = coworkingName;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: userData },
      });
      if (signUpError) throw signUpError;

      // 3. Auto-confirmer l'email via le backend (car l'utilisateur a déjà vérifié son OTP)
      if (signUpData?.user?.id) {
        await fetch(`${API_URL}/api/otp/auto-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: signUpData.user.id, email: cleanEmail, role }),
        });
      }

      // 4. Succès
      setStep('done');
    } catch (err) {
      setOtpError(err.message || 'Code incorrect. Veuillez réessayer.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Renvoyer le code ──────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtpError('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch(`${API_URL}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, prenom: prenom.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendTimer(60);
      }
    } catch { }
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
    { value: 'etudiant', label: 'Étudiant', icon: 'school', desc: 'Tarif réduit étudiant' },
  ];

  const roleTypes = [
    { value: 'member', label: 'Membre', icon: 'person', desc: 'Accéder aux espaces de coworking' },
    { value: 'formateur', label: 'Formateur', icon: 'school', desc: 'Créer et animer des formations' },
    { value: 'admin', label: 'Admin Coworking', icon: 'domain', desc: 'Gérer mon espace de coworking' }
  ];

  return (
    <div className="min-h-screen min-w-0 flex font-inter text-on-surface">

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
          background: 'linear-gradient(145deg, #100f0d 0%, #1c1b18 50%, #291a0c 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blobs décoratifs */}
        <div style={{
          position: 'absolute', top: -80, right: -60,
          width: 350, height: 350, borderRadius: '50%', opacity: 0.25,
          background: 'radial-gradient(circle, #f95d00, transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -40,
          width: 280, height: 280, borderRadius: '50%', opacity: 0.15,
          background: 'radial-gradient(circle, #ffedd8, transparent)',
          pointerEvents: 'none',
        }} />

        {/* Logo haut */}
        <div style={{ position: 'relative', zIndex: 10, marginBottom: '40px' }}>
          <BrandLogo to="/" light height={56} />
        </div>

        {/* Contenu central */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%' }} className="animate-fade-up">
          {/* Badge */}
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', borderRadius: 99,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              background: 'rgba(249,93,0,0.12)', color: '#f95d00',
              border: '1px solid rgba(249,93,0,0.25)',
              marginBottom: 12,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>star</span>
            Rejoindre la communauté
          </span>

          {/* Titre */}
          <h2
            className="font-sora"
            style={{ color: '#fbffff', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.18, marginBottom: 12 }}
          >
            Rejoignez<br />
            <span style={{ color: '#f95d00' }}>l&apos;élite</span><br />
            des workspace.
          </h2>

          {/* Description */}
          <p
            style={{
              color: 'rgba(251,255,255,0.75)',
              fontSize: 14, lineHeight: 1.6,
              marginBottom: 16,
              width: '100%',
              overflowWrap: 'break-word',
            }}
          >
            Créez votre profil membre et accédez à l&apos;ensemble de l&apos;écosystème DeskyWork.
          </p>

          {/* Avantages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: 'bolt', text: 'Réservation en 3 clics' },
              { icon: 'qr_code_2', text: 'QR Code d\'accès instantané' },
              { icon: 'notifications', text: 'Alertes temps réel' },
              { icon: 'receipt_long', text: 'Factures et historique complets' },
            ].map(({ icon, text }) => (
              <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(249,93,0,0.15)', color: '#f95d00',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                </span>
                <span style={{ color: 'rgba(251,255,255,0.85)', fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          PANNEAU DROIT — Formulaire / OTP / Succès
          ══════════════════════════════════════════ */}
      <div className="w-full min-w-0 flex-1 page-gradient flex flex-col relative overflow-hidden">
        {/* Blobs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,93,0,0.07), transparent)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,15,13,0.05), transparent)' }} />

        {/* Header mobile */}
        <header className="auth-mobile-header lg:hidden flex items-center justify-between px-6 py-4 relative z-10">
          <BrandLogo to="/" />
          <Link to="/login" className="text-secondary font-semibold text-sm hover:underline">
            Se connecter
          </Link>
        </header>

        <main className="w-full flex-1 flex items-center justify-center px-6 py-2 relative z-10">
          <div className="w-full max-w-[520px] animate-fade-up">

            {/* ── VUE SUCCÈS ─────────────────────────────────────────────── */}
            {step === 'done' && (
              <div className="glass-card rounded-3xl shadow-elevated p-8 text-center">
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
                  background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40,
                }}>✅</div>
                <h1 className="font-sora text-2xl font-bold text-primary mb-3">
                  Email vérifié !
                </h1>
                {role === 'admin' ? (
                  <>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                      Votre demande de création d'espace coworking a été enregistrée avec succès.<br />
                      Votre compte est actuellement <strong>en attente d'approbation</strong> par le Super Admin.<br />
                      Vous recevrez un email dès que votre espace sera validé.
                    </p>
                    <div style={{
                      background: '#fffbeb', border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 12, padding: '14px 18px', marginBottom: 24,
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: 20, flexShrink: 0 }}>schedule</span>
                      <p style={{ margin: 0, color: '#92400e', fontSize: 13, lineHeight: 1.6, textAlign: 'left' }}>
                        <strong>En attente d'approbation Super Admin</strong><br />
                        Le Super Administrateur valide votre espace sous 24h. Vous pourrez ensuite configurer vos tarifs, salles et disponibilités.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                      Félicitations <strong>{prenom}</strong>, votre compte a été créé et activé avec succès !<br />
                      Vous pouvez dès maintenant vous connecter pour réserver vos espaces et accéder aux services.
                    </p>
                    <div style={{
                      background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.3)',
                      borderRadius: 12, padding: '14px 18px', marginBottom: 24,
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: 20, flexShrink: 0 }}>check_circle</span>
                      <p style={{ margin: 0, color: '#15803d', fontSize: 13, lineHeight: 1.6, textAlign: 'left' }}>
                        <strong>Compte actif immédiatement</strong><br />
                        Votre adresse email est confirmée. Vous pouvez vous connecter immédiatement.
                      </p>
                    </div>
                  </>
                )}
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                  style={{ padding: '12px 24px', borderRadius: 12 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
                  Aller à la connexion
                </button>
              </div>
            )}

            {/* ── VUE OTP ────────────────────────────────────────────────── */}
            {step === 'otp' && (
              <>
                <div className="text-center mb-4">
                  <h1 className="font-sora text-2xl font-bold text-primary">Vérification email</h1>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Un code à 6 chiffres a été envoyé à<br />
                    <strong style={{ color: '#0040a0' }}>{email}</strong>
                  </p>
                </div>

                <div className="glass-card rounded-3xl shadow-elevated p-6">

                  {/* Icône */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', margin: '0 auto',
                      background: 'linear-gradient(135deg, #dae2ff, #eef1ff)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 32,
                    }}>🔐</div>
                  </div>

                  <p style={{ textAlign: 'center', color: '#5a6a8a', fontSize: 14, marginBottom: 20 }}>
                    Saisissez le code — le compte sera créé automatiquement dès le 6e chiffre
                  </p>

                  {/* Cases OTP */}
                  <OtpInput
                    onComplete={handleOtpComplete}
                    loading={otpLoading}
                    error={!!otpError}
                  />

                  {/* Erreur OTP */}
                  {otpError && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px', borderRadius: 10,
                      background: '#ffdad6', color: '#93000a',
                      display: 'flex', gap: 8, alignItems: 'center', fontSize: 13,
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                      {otpError}
                    </div>
                  )}

                  {/* Chargement */}
                  {otpLoading && (
                    <div style={{ textAlign: 'center', marginTop: 16, color: '#0040a0', fontSize: 14 }}>
                      <span className="animate-spin material-symbols-outlined" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 6 }}>refresh</span>
                      Vérification et création du compte…
                    </div>
                  )}

                  {/* Renvoyer */}
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    {resendTimer > 0 ? (
                      <p style={{ color: '#8a9ab5', fontSize: 13 }}>
                        Renvoyer dans <strong>{resendTimer}s</strong>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#0040a0', fontSize: 13, fontWeight: 600, textDecoration: 'underline',
                        }}
                      >
                        Renvoyer le code
                      </button>
                    )}
                  </div>

                  {/* Retour */}
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setStep('form'); setOtpError(''); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#8a9ab5', fontSize: 12,
                      }}
                    >
                      ← Modifier mon email
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── VUE FORMULAIRE ─────────────────────────────────────────── */}
            {step === 'form' && (
              <>
                <div className="text-center mb-2">
                  <h1 className="font-sora text-2xl font-bold text-[#100f0d]">
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

                  {/* Inscription sociale */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-outline-variant/30" />
                    <span className="text-[10px] text-on-surface-variant font-medium whitespace-nowrap">OU CONTINUER AVEC</span>
                    <div className="flex-1 h-px bg-outline-variant/30" />
                  </div>

                  <div className="auth-social-grid grid grid-cols-2 gap-3">
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

                    {/* Type de compte */}
                    <div className="flex flex-col gap-1">
                      <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor="reg-role">
                        Type de compte
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_circle</span>
                        </span>
                        <select
                          id="reg-role"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="form-input appearance-none"
                        >
                          {roleTypes.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Type de membre (uniquement pour les membres) */}
                    {role === 'member' && (
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
                    )}

                    {/* Nom du Coworking (uniquement pour les admins) */}
                    {role === 'admin' && (
                      <Field
                        id="reg-coworking" label="Nom de l'Espace Coworking" icon="domain"
                        value={coworkingName} onChange={(e) => setCoworkingName(e.target.value)}
                        placeholder="Ex: Encre & Cobalt Tunis" required
                      />
                    )}

                    {/* Champs spécifiques aux formateurs */}
                    {role === 'formateur' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor="reg-specialite">
                            Spécialité / Domaine
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none">
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>star</span>
                            </span>
                            <input
                              id="reg-specialite"
                              type="text"
                              value={specialite}
                              onChange={(e) => setSpecialite(e.target.value)}
                              className="form-input"
                              placeholder="Ex: UX Design, React, Marketing..."
                              required
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-label-sm font-semibold text-on-surface-variant" htmlFor="reg-biographie">
                            Biographie courte
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none" style={{ top: 12 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
                            </span>
                            <textarea
                              id="reg-biographie"
                              value={biographie}
                              onChange={(e) => setBiographie(e.target.value)}
                              className="form-input"
                              rows={3}
                              placeholder="Parcours, compétences clés, expérience..."
                              required
                              style={{ paddingLeft: 44 }}
                            />
                          </div>
                        </div>
                      </>
                    )}

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
                        ? <><span className="animate-spin material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Envoi du code…</>
                        : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span> Recevoir le code de vérification</>
                      }
                    </button>
                  </form>

                </div>

                <p className="text-center text-xs text-on-surface-variant mt-3">
                  Déjà inscrit?{' '}
                  <Link to="/login" className="text-secondary font-semibold hover:underline">
                    Se connecter
                  </Link>
                </p>
              </>
            )}

          </div>
        </main>

        <footer className="relative z-10 text-center py-2 px-6">
          <p className="text-[10px] text-outline-variant">
            © {new Date().getFullYear()} DeskyWork · Tous droits réservés
          </p>
        </footer>
      </div>
    </div>
  );
}



