import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentsApi } from '../services/api';

export default function SignDocumentPage() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const [doc,     setDoc]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed,  setSigned]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    documentsApi.getSignDocument(token)
      .then(d => { if (d.error) setError(d.error); else setDoc(d.document); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    setSigning(true);
    try {
      const res = await documentsApi.signDocument(token);
      if (res.error) { setError(res.error); return; }
      setSigned(true);
    } catch (e) { setError(e.message); }
    finally { setSigning(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
    </div>
  );

  if (signed) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <span className="material-symbols-outlined text-[#2fbe8f] block mb-3" style={{ fontSize: 56 }}>verified</span>
        <h1 className="font-sora font-bold text-primary text-2xl mb-2">Document signé !</h1>
        <p className="text-on-surface-variant text-sm mb-6">
          Votre signature électronique a été enregistrée avec succès.
        </p>
        <button onClick={() => navigate('/')}
          className="w-full py-2.5 bg-secondary text-white rounded-xl font-semibold text-sm hover:bg-secondary/90">
          Retour à l'accueil
        </button>
      </div>
    </div>
  );

  if (error || !doc) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <span className="material-symbols-outlined text-error block mb-3" style={{ fontSize: 48 }}>error</span>
        <h1 className="font-sora font-bold text-primary text-xl mb-2">Lien invalide</h1>
        <p className="text-on-surface-variant text-sm">{error || 'Ce lien de signature est invalide ou a déjà été utilisé.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-outline-variant/20 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>draw</span>
            </span>
            <div>
              <h1 className="font-sora font-bold text-primary text-lg">Signature électronique</h1>
              <p className="text-xs text-on-surface-variant">{doc.nom}</p>
            </div>
          </div>

          {doc.pdf_contenu && (
            <div className="bg-surface-container-low rounded-2xl p-4 mb-6 max-h-96 overflow-y-auto text-sm text-on-surface leading-relaxed"
              dangerouslySetInnerHTML={{ __html: doc.pdf_contenu }} />
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800 flex items-start gap-2">
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>info</span>
            En cliquant sur "Je signe ce document", vous confirmez avoir lu et accepté le contenu ci-dessus. Votre signature électronique sera enregistrée avec l'adresse IP de votre appareil.
          </div>

          <button onClick={handleSign} disabled={signing}
            className="w-full py-3 bg-secondary text-white rounded-2xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {signing ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />Signature en cours…</> : 'Je signe ce document'}
          </button>
        </div>
      </div>
    </div>
  );
}
