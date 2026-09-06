import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { guestApi } from '../services/api';
import BrandLogo from '../components/layout/BrandLogo';
import { getBookerNav } from '../utils/roles';

export default function BookingStep1() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [coworking, setCoworking] = useState(null);
  const [nav, setNav] = useState(getBookerNav('member'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setNav(getBookerNav(data?.role)));
    });
  }, []);

  useEffect(() => {
    const tenantId = searchParams.get('tenantId');
    if (tenantId) {
      setSelectedTenant(tenantId);
      guestApi.getCoworking(tenantId)
        .then(res => { if (res.coworking) setCoworking(res.coworking); })
        .catch(() => {});
    }
    fetchSpaces();
  }, [searchParams]);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      let query = supabase.from('espaces').select('*');
      
      if (selectedTenant) {
        query = query.eq('tenant_id', selectedTenant);
      }
      
      const { data, error } = await query.order('tarif_horaire', { ascending: true });

      if (error) throw error;
      setSpaces(data || []);
    } catch (e) {
      console.error('Error fetching spaces:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSpace = (spaceId) => {
    navigate(`/book/step2?espaceId=${spaceId}`);
  };

  const filteredSpaces = filterType === 'all' 
    ? spaces 
    : spaces.filter(s => s.type === filterType);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #f95d00', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F4F6F9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '48px' }}>
      
      {/* Top Header */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, backgroundColor: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', maxWidth: '1240px', margin: '0 auto' }}>
          <BrandLogo to={nav.home} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f95d00', backgroundColor: '#ffedd8', padding: '6px 14px', borderRadius: '99px' }}>
              Étape 1 sur 3
            </span>
            <Link 
              to={nav.home} 
              style={{ padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: '1px solid #c5c6ce', color: '#100f0d', textDecoration: 'none', backgroundColor: '#fff' }}
            >
              Annuler
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ paddingTop: '110px', maxWidth: '1240px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
        
        {/* Header Section — Fixed paragraph wrapping */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '32px', fontWeight: 700, color: '#100f0d', marginBottom: '10px' }}>
            Choisissez votre espace
          </h1>
          <p style={{ fontSize: '15px', color: '#4e4a46', maxWidth: '600px', width: '100%', margin: '0 auto', textAlign: 'center', lineHeight: '1.5' }}>
            Sélectionnez la salle ou le poste qui correspond à vos besoins de travail.
          </p>
        </div>

        {/* Carte du coworking (image + coordonnées) */}
        {coworking && (
          <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px', flexWrap: 'wrap' }}>
              <img
                src={coworking.cover_url || coworking.logo_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop'}
                alt={coworking.nom}
                style={{ width: '100%', maxWidth: 280, height: 140, objectFit: 'cover', borderRadius: 14, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#100f0d', margin: 0 }}>{coworking.nom}</h2>
                  <span style={{ background: '#ffedd8', color: '#f95d00', padding: '3px 10px', borderRadius: 99, fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                    {(coworking.ville || coworking.pays || 'Tunisie')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '13px', color: '#4e4a46' }}>
                  {coworking.adresse && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f95d00' }}>location_on</span>
                      {coworking.adresse}{coworking.ville ? `, ${coworking.ville}` : ''}
                    </span>
                  )}
                  {coworking.telephone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f95d00' }}>phone</span>
                      {coworking.telephone}
                    </span>
                  )}
                  {coworking.latitude && coworking.longitude && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f95d00' }}>place</span>
                      GPS : {coworking.latitude}, {coworking.longitude}
                      <a
                        href={`https://www.google.com/maps?q=${coworking.latitude},${coworking.longitude}`}
                        target="_blank" rel="noreferrer"
                        style={{ color: '#f95d00', fontWeight: 600, textDecoration: 'none' }}
                      >Voir sur la carte</a>
                    </span>
                  )}
                  {coworking.description && (
                    <span style={{ lineHeight: 1.6, marginTop: 4 }}>{coworking.description}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Badges — Clean Bootstrap-style Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '40px' }}>
          {[
            { id: 'all', label: 'Tous les espaces' },
            { id: 'open_space', label: 'Open Space' },
            { id: 'private_office', label: 'Bureau Privé' },
            { id: 'meeting_room', label: 'Salle de Réunion' },
            { id: 'training_room', label: 'Salle de Formation' },
            { id: 'event_space', label: 'Événement' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterType(id)}
              style={{
                padding: '8px 20px',
                borderRadius: '99px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: filterType === id ? 'none' : '1px solid #d0d7de',
                backgroundColor: filterType === id ? '#f95d00' : '#ffffff',
                color: filterType === id ? '#ffffff' : '#334155',
                boxShadow: filterType === id ? '0 4px 12px rgba(249,93,0,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grid List — Clean Bootstrap Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredSpaces.map((space) => (
            <div 
              key={space.id} 
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ backgroundColor: '#dae2ff', color: '#001847', padding: '4px 12px', borderRadius: '99px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {space.type ? space.type.replace('_', ' ') : 'Espace'}
                  </span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f95d00' }}>
                    {parseFloat(space.tarif_horaire).toFixed(2)} DT <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>/ h</span>
                  </span>
                </div>

                <div>
                  <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: 700, color: '#000d23', marginBottom: '6px' }}>
                    {space.nom}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                    Capacité : jusqu&apos;à <strong style={{ color: '#000d23' }}>{space.capacite}</strong> personnes.
                    {space.type === 'open_space'
                      ? ' Places partagées : plusieurs réservations au même horaire.'
                      : ' Réservation exclusive : un seul client par créneau.'}
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Disponible aujourd&apos;hui
                </span>
                <button
                  onClick={() => handleSelectSpace(space.id)}
                  style={{
                    backgroundColor: '#f95d00',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,84,203,0.2)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Sélectionner
                </button>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
