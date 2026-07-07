import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/dashboard');
    } catch (error) {
      setErrorMsg(error.message || 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-low font-inter text-on-surface min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-secondary/5 blur-[100px] rounded-full" />
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/5 blur-[100px] rounded-full" />

      <main className="flex-grow flex items-center justify-center relative z-10 px-margin-mobile md:px-0 py-xl">
        <div className="bg-surface-container-lowest w-full max-w-[480px] rounded-xl shadow-xl overflow-hidden border border-outline-variant/10 flex flex-col">
          <div className="p-lg md:p-xl flex flex-col items-center text-center space-y-2">
            <div className="mb-2">
              <BrandLogo to="/" />
            </div>
            <h1 className="font-sora text-headline-sm text-primary">Bon retour</h1>
            <p className="text-body-sm text-on-surface-variant max-w-[300px]">
              Accédez à votre espace coworking et gérez votre profil membre.
            </p>
          </div>

          {errorMsg && (
            <div className="mx-lg md:mx-xl mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-lg flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="px-lg pb-xl md:px-xl space-y-6">
            <div className="space-y-2">
              <label className="text-label-md font-semibold text-on-surface" htmlFor="email">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-10 pr-4 text-on-surface form-input-focus transition-all placeholder:text-outline-variant text-body-md"
                  placeholder="nom@entreprise.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-md font-semibold text-on-surface" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-10 pr-4 text-on-surface form-input-focus transition-all placeholder:text-outline-variant text-body-md"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-on-secondary font-semibold text-label-md py-4 rounded-lg shadow-lg hover:bg-secondary-container transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>

            <div className="text-center pt-2">
              <p className="text-body-sm text-on-surface-variant">
                Pas encore de compte ?{' '}
                <Link to="/register" className="text-secondary font-semibold hover:underline">
                  Créer un compte
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>

      <footer className="w-full py-sm px-margin-desktop flex justify-center relative z-10">
        <p className="text-body-sm text-outline-variant">
          © 2026 Encre &amp; Cobalt · VC LOW Coworking
        </p>
      </footer>
    </div>
  );
}
