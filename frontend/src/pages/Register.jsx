import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [typeMembre, setTypeMembre] = useState('individuel');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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
          data: {
            nom,
            prenom,
            telephone,
            role: 'member',
            type_membre: typeMembre,
          },
        },
      });

      if (error) throw error;
      setSuccessMsg('Compte créé ! Vérifiez votre email ou connectez-vous directement.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setErrorMsg(error.message || 'Erreur lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-inter text-on-surface antialiased min-h-screen bg-[#F4F6F9]">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20">
        <BrandLogo to="/" />
        <div className="flex gap-sm items-center">
          <Link to="/login" className="px-sm py-2 text-secondary font-semibold text-label-md">
            Connexion
          </Link>
        </div>
      </header>

      <main className="min-h-screen pt-28 pb-xl px-margin-mobile flex flex-col items-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="w-full max-w-[640px]">
          <div className="text-center mb-lg">
            <h1 className="font-sora text-headline-xl text-primary mb-xs">Rejoignez l&apos;espace</h1>
            <p className="text-body-lg text-on-surface-variant">
              Créez votre profil membre coworking — Module A
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl custom-shadow p-lg border border-outline-variant/20">
            {errorMsg && (
              <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-lg flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-md p-sm bg-secondary-fixed text-on-secondary-fixed text-body-sm rounded-lg flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="prenom">Prénom</label>
                  <input
                    id="prenom"
                    required
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                    placeholder="Jean"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="nom">Nom</label>
                  <input
                    id="nom"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                  placeholder="jean.dupont@entreprise.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="telephone">Téléphone</label>
                  <input
                    id="telephone"
                    type="tel"
                    required
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                    placeholder="+216 99 999 999"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="type_membre">Type de membre</label>
                  <select
                    id="type_membre"
                    value={typeMembre}
                    onChange={(e) => setTypeMembre(e.target.value)}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                  >
                    <option value="individuel">Individuel</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="etudiant">Étudiant</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="password">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-lg px-sm py-3 form-input-focus text-body-md"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-secondary text-on-secondary py-4 rounded-lg font-semibold text-label-md shadow-lg hover:bg-secondary-container transition-all active:scale-[0.98] disabled:opacity-50 mt-sm"
              >
                {loading ? 'Création...' : 'Créer mon compte'}
              </button>
            </form>

            <p className="text-center text-body-sm text-on-surface-variant mt-md">
              Déjà inscrit ?{' '}
              <Link to="/login" className="text-secondary font-semibold hover:underline">Se connecter</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
