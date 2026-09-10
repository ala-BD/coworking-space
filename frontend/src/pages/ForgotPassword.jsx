import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/layout/BrandLogo';
import { API_URL } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(() => {
    const until = Number(sessionStorage.getItem('password-reset-cooldown-until') || 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    setSent(false);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const response = await fetch(`${API_URL}/api/auth/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’envoyer le lien.');
      const cooldownUntil = Date.now() + 60000;
      sessionStorage.setItem('password-reset-cooldown-until', String(cooldownUntil));
      setCooldown(60);
      setSent(true);
    } catch (resetError) {
      setError(resetError.message || 'Impossible d’envoyer le lien de réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen page-gradient flex flex-col font-inter text-on-surface">
      <header className="flex items-center px-6 py-5 relative z-10">
        <BrandLogo to="/" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[440px] animate-fade-up">
          <div className="text-center mb-5">
            <h1 className="font-sora text-2xl font-bold text-[#100f0d] mb-1">Mot de passe oublié</h1>
            <p className="text-body-sm text-on-surface-variant">Saisissez votre email pour recevoir le lien de réinitialisation</p>
          </div>
          <div className="glass-card rounded-3xl shadow-elevated p-6">
            {sent && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Un lien de réinitialisation a été envoyé à cette adresse. Consultez votre boîte email.</div>}
            {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-label-sm font-semibold text-on-surface" htmlFor="forgot-email">Adresse email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-outline pointer-events-none"><span className="material-symbols-outlined" style={{ fontSize: 19 }}>mail</span></span>
                  <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="form-input" placeholder="nom@entreprise.com" />
                </div>
              </div>
              <button type="submit" disabled={loading || cooldown > 0} className="btn-primary w-full" style={{ padding: '14px 24px', borderRadius: 12 }}>
                {loading ? <><span className="animate-spin material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Envoi en cours...</> : cooldown > 0 ? `Réessayer dans ${cooldown}s` : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span> Recevoir le lien</>}
              </button>
            </form>
          </div>
          <p className="text-center text-body-sm text-on-surface-variant mt-5"><Link to="/login" className="text-secondary font-semibold hover:underline">Retour à la connexion</Link></p>
        </div>
      </main>
    </div>
  );
}
