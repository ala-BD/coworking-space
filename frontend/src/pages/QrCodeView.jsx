import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function QrCodeView({ session }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data);
  };

  return (
    <div className="bg-background min-h-screen text-on-background font-inter pb-xl">
      {/* Top Header */}
      <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-sm">
        <div className="flex justify-between items-center px-margin-desktop py-sm max-w-container-max mx-auto">
          <Link to="/dashboard" className="font-sora text-headline-md font-bold text-primary">
            NexusDesk
          </Link>
          <Link to="/dashboard" className="border border-outline-variant/30 text-primary px-sm py-xs rounded-lg font-semibold text-label-md hover:bg-surface-container-high transition-colors">
            Back to Portal
          </Link>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-24 max-w-[500px] mx-auto px-margin-mobile py-lg text-center">
        <div className="bg-surface-container-lowest p-lg rounded-3xl border border-outline-variant/10 shadow-sm space-y-lg">
          <div>
            <span className="bg-secondary-fixed text-on-secondary-fixed px-sm py-xs rounded-full font-semibold text-label-sm uppercase tracking-wider mb-sm inline-block">
              Physical Access Pass
            </span>
            <h1 className="font-sora text-headline-sm font-semibold text-primary">Your Entry QR Code</h1>
            <p className="text-body-sm text-on-surface-variant">
              Present this pass to the check-in scanner at the reception desk.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-lg rounded-2xl border border-outline-variant/20 inline-block shadow-inner mx-auto">
            {/* We will mock a QR code visually using SVG or CSS patterns */}
            <div className="w-56 h-56 flex flex-col items-center justify-center border-4 border-primary rounded-xl p-md relative bg-white">
              {/* Visual QR Code Mock Pattern */}
              <div className="w-full h-full bg-[radial-gradient(circle_at_2px_2px,rgba(0,13,35,1)_3px,transparent_0)] bg-[size:16px_16px] border border-primary/20 opacity-90"></div>
              {/* Corner squares for QR look */}
              <div className="absolute top-2 left-2 w-12 h-12 bg-primary border-4 border-white"></div>
              <div className="absolute top-2 right-2 w-12 h-12 bg-primary border-4 border-white"></div>
              <div className="absolute bottom-2 left-2 w-12 h-12 bg-primary border-4 border-white"></div>
            </div>
          </div>

          <div className="space-y-sm text-left border-t border-outline-variant/10 pt-md text-body-sm text-on-surface-variant">
            <div className="flex justify-between">
              <span>Cardholder</span>
              <span className="font-semibold text-primary">{profile?.prenom} {profile?.nom}</span>
            </div>
            <div className="flex justify-between">
              <span>Member ID</span>
              <span className="font-mono text-primary text-xs">{session.user.id.substring(0, 18)}...</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="font-semibold text-secondary">Active Membership</span>
            </div>
          </div>

          <div className="p-sm bg-surface-container-low rounded-xl text-body-xs text-on-surface-variant flex gap-sm items-start text-left">
            <span className="material-symbols-outlined text-secondary">info</span>
            <p>
              Your timer starts automatically in the system when the front desk checks you in. Don't forget to checkout when leaving!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
