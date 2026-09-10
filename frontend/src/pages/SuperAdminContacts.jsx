import React, { useEffect, useState } from 'react';
import PortalLayout from '../components/layout/PortalLayout';
import { superAdminApi } from '../services/superAdminApi';
import { supabase } from '../supabaseClient';

const STATUS_LABELS = { nouveau: 'Nouveau', lu: 'Lu', traite: 'Traité' };

export default function SuperAdminContacts() {
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getContacts({ statut: status, search });
      setContacts(data.contacts || []);
      setError('');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    });
  }, []);

  useEffect(() => { if (profile) loadContacts(); }, [profile, status]);

  const updateStatus = async (id, nextStatus) => {
    try {
      const data = await superAdminApi.updateContact(id, nextStatus);
      setContacts(items => items.map(item => item.id === id ? data.contact : item));
    } catch (err) { setError(err.message); }
  };

  return (
    <PortalLayout profile={profile}>
      <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Super Admin</p><h1 className="font-sora text-2xl font-bold">Contacts reçus</h1></div>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadContacts()} placeholder="Rechercher..." className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm" />
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm"><option value="">Tous</option><option value="nouveau">Nouveaux</option><option value="lu">Lus</option><option value="traite">Traités</option></select>
          </div>
        </div>
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-white shadow-sm">
          {loading ? <p className="text-sm text-on-surface-variant">Chargement...</p> : contacts.length === 0 ? <p className="rounded-2xl bg-white p-6 text-sm text-on-surface-variant">Aucun contact reçu.</p> : contacts.map(contact => (
            <article key={contact.id} className="grid gap-3 border-b border-outline-variant/15 px-4 py-4 last:border-b-0 sm:grid-cols-[1.1fr_1fr_1.4fr_1.8fr_auto] sm:items-center sm:px-5">
              <div className="min-w-0"><h2 className="truncate font-semibold">{contact.nom}</h2><a className="block truncate text-xs text-secondary" href={`mailto:${contact.email}`}>{contact.email}</a></div>
              <div className="min-w-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">Sujet</span><p className="truncate text-sm font-medium">{contact.sujet}</p></div>
              <div className="min-w-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">Message</span><p className="truncate text-sm text-on-surface-variant" title={contact.message}>{contact.message}</p></div>
              <time className="text-xs text-on-surface-variant/60">{new Date(contact.created_at).toLocaleString('fr-FR')}</time>
              <select aria-label={`Statut du contact ${contact.nom}`} value={contact.statut} onChange={e => updateStatus(contact.id, e.target.value)} className="w-fit rounded-lg border border-outline-variant/30 px-2 py-1 text-xs">
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </article>
          ))}
        </div>
      </main>
    </PortalLayout>
  );
}
