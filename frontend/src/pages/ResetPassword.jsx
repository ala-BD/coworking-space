import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const recoveryError = hashParams.get('error_code') || queryParams.get('error_code');
    if (recoveryError === 'otp_expired' || recoveryError === 'access_denied') {
      setError('Ce lien de réinitialisation est expiré ou a déjà été utilisé. Demandez un nouveau lien.');
      setChecking(false);
      return undefined;
    }

    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setError('Ce lien est invalide ou a expiré. Demandez un nouveau lien.');
      setChecking(false);
    };
    checkRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setError('');
        setChecking(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== confirmation) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      await supabase.auth.signOut();
    } catch (updateError) {
      setError(updateError.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen page-gradient flex flex-col font-inter text-on-surface">
      <header className="flex items-center px-6 py-5 relative z-10"><BrandLogo to="/" /></header>
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[440px] animate-fade-up">
          <div className="text-center mb-5"><h1 className="font-sora text-2xl font-bold text-[#100f0d] mb-1">Nouveau mot de passe</h1><p className="text-body-sm text-on-surface-variant">Choisissez un nouveau mot de passe sécurisé</p></div>
          <div className="glass-card rounded-3xl shadow-elevated p-6">
            {checking ? <p className="text-center text-sm text-on-surface-variant">Vérification du lien...</p> : success ? <div className="text-center"><p className="mb-4 text-sm text-green-800">Votre mot de passe a été modifié avec succès.</p><Link to="/login" className="btn-primary w-full" style={{ padding: '14px 24px', borderRadius: 12 }}>Se connecter</Link></div> : <>
              {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5"><label className="block text-label-sm font-semibold" htmlFor="new-password">Nouveau mot de passe</label><div className="relative"><input id="new-password" type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="form-input" style={{ paddingRight: 44 }} placeholder="Minimum 8 caractères" /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-secondary" tabIndex={-1}><span className="material-symbols-outlined" style={{ fontSize: 19 }}>{showPassword ? 'visibility_off' : 'visibility'}</span></button></div></div>
                <div className="space-y-1.5"><label className="block text-label-sm font-semibold" htmlFor="confirm-password">Confirmer le mot de passe</label><input id="confirm-password" type={showPassword ? 'text' : 'password'} required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="form-input" placeholder="Répétez le mot de passe" /></div>
                <button type="submit" disabled={loading} className="btn-primary w-full" style={{ padding: '14px 24px', borderRadius: 12 }}>{loading ? 'Modification en cours...' : 'Modifier le mot de passe'}</button>
              </form>
            </>}
          </div>
          {!success && <p className="text-center text-body-sm text-on-surface-variant mt-5"><Link to="/forgot-password" className="text-secondary font-semibold hover:underline">Demander un nouveau lien</Link><span className="mx-2">·</span><button type="button" onClick={() => navigate('/login')} className="text-secondary font-semibold hover:underline">Retour à la connexion</button></p>}
        </div>
      </main>
    </div>
  );
}
