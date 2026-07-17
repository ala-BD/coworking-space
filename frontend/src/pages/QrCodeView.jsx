import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { memberApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

export default function QrCodeView({ session }) {
  const [profile, setProfile] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(prof);

      const qr = await memberApi.getQr();
      setQrData(qr);
    } catch (err) {
      setError(err.message || 'Erreur de chargement du QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="max-w-[500px] mx-auto text-center">
        <header className="mb-lg">
          <h1 className="font-sora text-headline-lg text-primary">Mon accès QR</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Présentez ce pass à l&apos;accueil pour entrer dans l&apos;espace
          </p>
        </header>

        {error && (
          <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {error}
          </div>
        )}

        <div className="bg-white p-lg rounded-3xl border border-outline-variant/10 shadow-sm space-y-lg">
          <div>
            <span className="bg-secondary-fixed text-on-secondary-fixed px-sm py-xs rounded-full font-semibold text-label-sm uppercase tracking-wider mb-sm inline-block">
              Pass d&apos;accès
            </span>
            <p className="text-body-sm text-on-surface-variant">
              Scannez ce code à la réception pour activer votre session.
            </p>
          </div>

          <div className="bg-white p-lg rounded-2xl border border-outline-variant/20 inline-block shadow-inner mx-auto">
            <div className="w-56 h-56 flex items-center justify-center border-4 border-primary rounded-xl p-md bg-white">
              {qrData?.payload ? (
                <QRCodeSVG
                  value={qrData.payload}
                  size={192}
                  level="H"
                  fgColor="#0D1F23"
                  bgColor="#FFFFFF"
                  imageSettings={{
                    src: '',
                    height: 0,
                    width: 0,
                    excavate: false,
                  }}
                />
              ) : (
                <div className="w-48 h-48 bg-surface-container-low rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">qr_code_2</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-sm text-left border-t border-outline-variant/10 pt-md text-body-sm text-on-surface-variant">
            <div className="flex justify-between">
              <span>Titulaire</span>
              <span className="font-semibold text-primary">{profile?.prenom} {profile?.nom}</span>
            </div>
            <div className="flex justify-between">
              <span>Identifiant membre</span>
              <span className="font-mono text-primary text-xs">{session.user.id.substring(0, 18)}...</span>
            </div>
            <div className="flex justify-between">
              <span>Statut</span>
              <span className="font-semibold text-secondary capitalize">{profile?.statut_compte || 'actif'}</span>
            </div>
          </div>

          <div className="p-sm bg-surface-container-low rounded-xl text-body-xs text-on-surface-variant flex gap-sm items-start text-left">
            <span className="material-symbols-outlined text-secondary">info</span>
            <p>
              Votre session démarre automatiquement lors du check-in à l&apos;accueil.
              Pensez à vous déconnecter en partant.
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
