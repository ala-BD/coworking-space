import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { tenantAdminApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const BUCKET = 'coworking-images';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

async function uploadImageToBackend(file, folder) {
  const base64Data = await fileToBase64(file);
  const res = await tenantAdminApi.uploadPhoto({
    base64Data,
    fileName: file.name,
    fileType: file.type,
    folder,
  });
  return res.publicUrl;
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/30 bg-white text-sm text-primary outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15 transition-all placeholder:text-on-surface-variant/50';

function ImageUploadZone({ label, hint, imageUrl, onUpload, uploading, onRemove, aspect = 'cover' }) {
  const fileRef = useRef(null);

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-2">{label}</label>
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${uploading ? 'border-secondary/50 bg-secondary/3' : 'border-outline-variant/40 hover:border-secondary hover:bg-secondary/3'}`}
        style={{ height: aspect === 'cover' ? 200 : 140 }}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => onUpload(e.target.files?.[0])} />

        {imageUrl ? (
          <>
            <img src={imageUrl} alt={label}
              className={`w-full h-full ${aspect === 'cover' ? 'object-cover' : 'object-contain p-4'}`} />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <div className="flex flex-col items-center gap-2 text-white">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>photo_camera</span>
                <span className="text-sm font-semibold">Changer l'image</span>
              </div>
            </div>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-secondary" />
            <p className="text-sm text-on-surface-variant font-medium">Upload en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 40 }}>add_photo_alternate</span>
            <p className="text-sm text-on-surface-variant font-medium">Cliquer pour uploader</p>
            <p className="text-xs text-on-surface-variant/60">{hint}</p>
          </div>
        )}
      </div>
      {imageUrl && (
        <button onClick={onRemove}
          className="mt-1.5 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
          Supprimer l'image
        </button>
      )}
    </div>
  );
}

export default function AdminCoworkingProfile({ session }) {
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
const [form, setForm] = useState({
    nom: '', description: '', adresse: '', ville: '', pays: 'Tunisie',
    telephone: '', email: '', site_web: '', logo_url: '', cover_url: '',
    latitude: '', longitude: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const showError = (msg) => { setToastErr(msg); setTimeout(() => setToastErr(''), 4000); };

  useEffect(() => { loadData(); }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
      const res = await tenantAdminApi.getTenant();
      const t = res.tenant;
      setTenant(t);
      setForm({
        nom: t.nom || '',
        description: t.description || '',
        adresse: t.adresse || '',
        ville: t.ville || '',
        pays: t.pays || 'Tunisie',
        telephone: t.telephone || '',
        email: t.email || '',
        site_web: t.site_web || '',
        logo_url: t.logo_url || '',
        cover_url: t.cover_url || '',
        latitude: t.latitude != null ? String(t.latitude) : '',
        longitude: t.longitude != null ? String(t.longitude) : '',
      });
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  const handleUploadLogo = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Fichier invalide.'); return; }
    if (file.size > 3 * 1024 * 1024) { showError('Logo trop grand. Maximum 3 MB.'); return; }
    setUploadingLogo(true);
    try {
      const url = await uploadImageToBackend(file, 'logos');
      setForm(f => ({ ...f, logo_url: url }));
    } catch (e) { showError(e.message); }
    finally { setUploadingLogo(false); }
  };

  const handleUploadCover = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Fichier invalide.'); return; }
    if (file.size > 8 * 1024 * 1024) { showError('Image trop grande. Maximum 8 MB.'); return; }
    setUploadingCover(true);
    try {
      const url = await uploadImageToBackend(file, 'covers');
      setForm(f => ({ ...f, cover_url: url }));
    } catch (e) { showError(e.message); }
    finally { setUploadingCover(false); }
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { showError('Le nom du coworking est requis.'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.latitude === '') payload.latitude = null;
      if (payload.longitude === '') payload.longitude = null;
      if (payload.latitude != null && isNaN(parseFloat(payload.latitude))) { showError('Latitude invalide.'); setSaving(false); return; }
      if (payload.longitude != null && isNaN(parseFloat(payload.longitude))) { showError('Longitude invalide.'); setSaving(false); return; }
      await tenantAdminApi.updateTenant(payload);
      showToast('Profil du coworking mis à jour avec succès !');
      await loadData();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );

  return (
    <PortalLayout profile={profile} onLogout={() => supabase.auth.signOut()}>

      {/* Toasts */}
      {toast && (
        <div className="fixed top-20 right-4 z-[9998] flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl text-sm font-semibold">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>{toast}
        </div>
      )}
      {toastErr && (
        <div className="fixed top-20 right-4 z-[9998] flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl shadow-xl text-sm font-semibold">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>{toastErr}
        </div>
      )}

      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-sora font-bold text-2xl sm:text-3xl" style={{ color: '#100f0d' }}>Profil du Coworking</h1>
          <p className="text-on-surface-variant text-sm mt-1">Personnalisez les informations et les visuels de votre espace</p>
        </div>

        {/* Preview card */}
        {(form.cover_url || form.logo_url) && (
          <div className="bg-white rounded-3xl border border-outline-variant/20 shadow-sm mb-8 overflow-hidden">
            <div className="relative h-48 bg-gradient-to-br from-secondary/20 to-secondary/5">
              {form.cover_url && (
                <img src={form.cover_url} alt="Couverture" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {form.logo_url && (
                <div className="absolute bottom-4 left-5">
                  <img src={form.logo_url} alt="Logo"
                    className="w-16 h-16 rounded-2xl object-contain bg-white shadow-lg border-2 border-white" />
                </div>
              )}
            </div>
            <div className="px-5 py-4">
              <h3 className="font-sora font-bold text-lg" style={{ color: '#100f0d' }}>{form.nom || 'Nom du coworking'}</h3>
              {form.ville && <p className="text-xs text-on-surface-variant mt-0.5">{form.ville}{form.pays ? `, ${form.pays}` : ''}</p>}
            </div>
          </div>
        )}

        <div className="space-y-6">

          {/* Section Visuels */}
          <div className="bg-white rounded-3xl border border-outline-variant/20 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>image</span>
              <h2 className="font-sora font-semibold text-primary">Visuels</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ImageUploadZone
                label="Logo du coworking"
                hint="PNG transparent recommandé · max 3 MB"
                imageUrl={form.logo_url}
                onUpload={handleUploadLogo}
                uploading={uploadingLogo}
                onRemove={() => setForm(f => ({ ...f, logo_url: '' }))}
                aspect="logo"
              />
              <ImageUploadZone
                label="Photo de couverture"
                hint="Idéalement 1200×400 px · max 8 MB"
                imageUrl={form.cover_url}
                onUpload={handleUploadCover}
                uploading={uploadingCover}
                onRemove={() => setForm(f => ({ ...f, cover_url: '' }))}
                aspect="cover"
              />
            </div>
          </div>

          {/* Section Informations */}
          <div className="bg-white rounded-3xl border border-outline-variant/20 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>info</span>
              <h2 className="font-sora font-semibold text-primary">Informations générales</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">Nom du coworking *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex : Encre Cobalt Coworking"
                  className={inputCls} />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Décrivez votre espace coworking en quelques phrases…"
                  rows={3}
                  className={`${inputCls} resize-none`} />
              </div>

              {[
                { key: 'adresse',   label: 'Adresse',     placeholder: 'Numéro, rue, quartier', col: 2 },
                { key: 'ville',     label: 'Ville',       placeholder: 'Ex : Tunis', col: 1 },
                { key: 'pays',      label: 'Pays',        placeholder: 'Ex : Tunisie', col: 1 },
                { key: 'telephone', label: 'Téléphone',   placeholder: '+216 XX XXX XXX', col: 1 },
                { key: 'email',     label: 'Email',       placeholder: 'contact@coworking.tn', col: 1 },
                { key: 'site_web',  label: 'Site web',    placeholder: 'https://votre-site.tn', col: 2 },
                { key: 'latitude',  label: 'Latitude (GPS)', placeholder: 'Ex : 36.806496', col: 1 },
                { key: 'longitude', label: 'Longitude (GPS)', placeholder: 'Ex : 10.181532', col: 1 },
              ].map(({ key, label, placeholder, col }) => (
                <div key={key} className={col === 2 ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1.5">{label}</label>
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Bouton sauvegarder */}
          <div className="flex justify-end gap-3">
            <button onClick={loadData}
              className="px-5 py-2.5 border border-outline-variant/30 text-on-surface-variant rounded-xl font-semibold text-sm hover:bg-surface-container transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || uploadingLogo || uploadingCover}
              className="px-7 py-2.5 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>save</span>
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
