import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { documentsApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const DOC_TYPE_LABELS = {
  reglement_interieur:      { label: 'Règlement intérieur',         icon: 'gavel',          required: true },
  politique_confidentialite:{ label: 'Politique de confidentialité', icon: 'privacy_tip',    required: true },
  contrat_abonnement:       { label: 'Contrat d\'abonnement',        icon: 'description',    required: false },
  cin_passeport:            { label: 'CIN / Passeport',              icon: 'badge',          required: false },
  justificatif_etudiant:    { label: 'Justificatif étudiant',        icon: 'school',         required: false },
  convention_formateur:     { label: 'Convention formateur',         icon: 'handshake',      required: false },
  autre:                    { label: 'Autre document',               icon: 'attach_file',    required: false },
};

export default function MemberDocuments({ session }) {
  const [profile,   setProfile]   = useState(null);
  const [docs,      setDocs]      = useState([]);
  const [reglement, setReglement] = useState(null);
  const [politique, setPolitique] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [success,   setSuccess]   = useState('');
  const [error,     setError]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [accepting, setAccepting] = useState('');
  const fileRef = useRef(null);
  const [uploadForm, setUploadForm] = useState({ type_doc: 'cin_passeport', nom: '' });

  useEffect(() => { loadData(); }, [session]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3500); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error)   { const t = setTimeout(() => setError(''),   3500); return () => clearTimeout(t); } }, [error]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
      const { documents } = await documentsApi.getMyDocuments();
      setDocs(documents || []);
      // Charger le contenu des documents légaux
      const [reg, pol] = await Promise.all([
        documentsApi.getContent('reglement_interieur'),
        documentsApi.getContent('politique_confidentialite'),
      ]);
      setReglement(reg.document);
      setPolitique(pol.document);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAccept = async (type_doc) => {
    setAccepting(type_doc);
    try {
      const { message } = await documentsApi.accept(type_doc);
      setSuccess(message || 'Accepté.');
      await loadData();
    } catch (e) { setError(e.message); }
    finally { setAccepting(''); }
  };

  const handleUpload = async () => {
    if (!uploadForm.nom.trim()) { setError('Veuillez saisir un nom pour le document.'); return; }
    setUploading(true);
    try {
      // Si un fichier est sélectionné, upload vers Supabase Storage
      let url = null;
      if (fileRef.current?.files?.[0]) {
        const file = fileRef.current.files[0];
        const path = `documents/${session.user.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        url = urlData.publicUrl;
      }
      await documentsApi.upload({ ...uploadForm, url });
      setSuccess('Document ajouté.');
      setUploadForm({ type_doc: 'cin_passeport', nom: '' });
      if (fileRef.current) fileRef.current.value = '';
      await loadData();
    } catch (e) { setError('Erreur upload : ' + e.message); }
    finally { setUploading(false); }
  };

  const isAccepted = (type) => docs.some(d => d.type_doc === type && d.accepte);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );

  return (
    <PortalLayout profile={profile} onLogout={() => supabase.auth.signOut()}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">

        <div className="mb-6">
          <h1 className="font-sora font-bold text-primary text-2xl sm:text-3xl">Mes documents</h1>
          <p className="text-on-surface-variant text-sm mt-1">Contrats, règlement intérieur et justificatifs.</p>
        </div>

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>{success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>{error}
          </div>
        )}

        {/* ── Documents légaux (acceptation) ── */}
        <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 mb-4 shadow-sm">
          <h2 className="font-sora font-bold text-primary text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>gavel</span>
            Documents obligatoires
          </h2>
          <div className="space-y-3">
            {/* Règlement intérieur */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${isAccepted('reglement_interieur') ? 'bg-emerald-100' : 'bg-amber-50'}`}>
                  <span className={`material-symbols-outlined ${isAccepted('reglement_interieur') ? 'text-emerald-600' : 'text-amber-600'}`} style={{ fontSize: 18 }}>
                    {isAccepted('reglement_interieur') ? 'verified' : 'gavel'}
                  </span>
                </span>
                <div>
                  <p className="font-semibold text-primary text-sm">Règlement intérieur</p>
                  {isAccepted('reglement_interieur')
                    ? <p className="text-xs text-emerald-600 font-medium">✓ Accepté</p>
                    : <p className="text-xs text-amber-600 font-medium">Lecture et acceptation requises</p>}
                </div>
              </div>
              {!isAccepted('reglement_interieur') && (
                <div className="flex gap-2 shrink-0">
                  {reglement?.contenu && (
                    <button onClick={() => window.open('about:blank').document.write(reglement.contenu)}
                      className="text-xs px-3 py-1.5 border border-outline-variant/30 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold">
                      Lire
                    </button>
                  )}
                  <button onClick={() => handleAccept('reglement_interieur')} disabled={accepting === 'reglement_interieur'}
                    className="text-xs px-3 py-1.5 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 disabled:opacity-50">
                    {accepting === 'reglement_interieur' ? '…' : 'Accepter'}
                  </button>
                </div>
              )}
            </div>

            {/* Politique de confidentialité */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${isAccepted('politique_confidentialite') ? 'bg-emerald-100' : 'bg-amber-50'}`}>
                  <span className={`material-symbols-outlined ${isAccepted('politique_confidentialite') ? 'text-emerald-600' : 'text-amber-600'}`} style={{ fontSize: 18 }}>
                    {isAccepted('politique_confidentialite') ? 'verified' : 'privacy_tip'}
                  </span>
                </span>
                <div>
                  <p className="font-semibold text-primary text-sm">Politique de confidentialité</p>
                  {isAccepted('politique_confidentialite')
                    ? <p className="text-xs text-emerald-600 font-medium">✓ Acceptée</p>
                    : <p className="text-xs text-amber-600 font-medium">Lecture et acceptation requises</p>}
                </div>
              </div>
              {!isAccepted('politique_confidentialite') && (
                <div className="flex gap-2 shrink-0">
                  {politique?.contenu && (
                    <button onClick={() => window.open('about:blank').document.write(politique.contenu)}
                      className="text-xs px-3 py-1.5 border border-outline-variant/30 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold">
                      Lire
                    </button>
                  )}
                  <button onClick={() => handleAccept('politique_confidentialite')} disabled={accepting === 'politique_confidentialite'}
                    className="text-xs px-3 py-1.5 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 disabled:opacity-50">
                    {accepting === 'politique_confidentialite' ? '…' : 'Accepter'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Mes documents uploadés ── */}
        <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 mb-4 shadow-sm">
          <h2 className="font-sora font-bold text-primary text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>folder</span>
            Mes justificatifs
          </h2>

          {docs.filter(d => !['reglement_interieur', 'politique_confidentialite'].includes(d.type_doc)).length === 0 ? (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-on-surface-variant/30 block mb-2" style={{ fontSize: 40 }}>folder_open</span>
              <p className="text-sm text-on-surface-variant">Aucun justificatif uploadé.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {docs.filter(d => !['reglement_interieur', 'politique_confidentialite'].includes(d.type_doc)).map((doc) => {
                const info = DOC_TYPE_LABELS[doc.type_doc] || DOC_TYPE_LABELS.autre;
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary text-sm truncate">{doc.nom}</p>
                      <p className="text-xs text-on-surface-variant">{info.label}</p>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="text-secondary hover:text-secondary/70 text-xs font-semibold shrink-0">
                        Voir
                      </a>
                    )}
                    {doc.signe && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Signé</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulaire upload */}
          <div className="border-t border-outline-variant/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Ajouter un document</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Type</label>
                <select value={uploadForm.type_doc}
                  onChange={e => setUploadForm(f => ({ ...f, type_doc: e.target.value }))}
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm outline-none focus:border-secondary">
                  {Object.entries(DOC_TYPE_LABELS).filter(([k]) => !['reglement_interieur', 'politique_confidentialite'].includes(k)).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Nom</label>
                <input value={uploadForm.nom} onChange={e => setUploadForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex : CIN_AliBen.pdf"
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-sm outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Fichier</label>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-xs text-on-surface-variant file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-secondary/10 file:text-secondary" />
              </div>
            </div>
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50">
              {uploading
                ? <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full inline-block" />Upload…</>
                : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>Ajouter</>}
            </button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
