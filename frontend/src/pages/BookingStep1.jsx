import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BrandLogo from '../components/layout/BrandLogo';

export default function BookingStep1() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tenantId = searchParams.get('tenantId');
    if (tenantId) {
      setSelectedTenant(tenantId);
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
      setSpaces(data);
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
      <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6F9] min-h-screen text-on-background font-inter pb-xl">
      {/* Top Header */}
      <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-sm">
        <div className="flex justify-between items-center px-margin-desktop py-sm max-w-container-max mx-auto">
          <BrandLogo to="/dashboard" />
          <div className="flex items-center gap-sm">
            <span className="text-body-sm text-on-surface-variant font-semibold">Étape 1 sur 3</span>
            <Link to="/dashboard" className="border border-outline-variant/30 text-primary px-sm py-xs rounded-lg font-semibold text-label-md hover:bg-surface-container-high transition-colors">
              Annuler
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-24 max-w-container-max mx-auto px-margin-desktop py-lg">
        <div className="text-center mb-xl">
          <h1 className="font-sora text-headline-lg text-primary mb-xs">Choisissez votre espace</h1>
          <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
            Sélectionnez la salle ou le poste qui correspond à vos besoins de travail.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-xs justify-center mb-xl">
          {['all', 'open_space', 'private_office', 'meeting_room', 'training_room'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-md py-sm rounded-full font-semibold text-label-sm uppercase transition-all ${
                filterType === type 
                  ? 'bg-secondary text-on-secondary shadow-sm' 
                  : 'bg-surface-container-lowest text-primary hover:bg-surface-container-high border border-outline-variant/10'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Grid List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {filteredSpaces.map((space) => (
            <div key={space.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
              <div className="p-lg space-y-md">
                <div className="flex justify-between items-start">
                  <span className="bg-secondary-fixed text-on-secondary-fixed px-sm py-xs rounded-full font-semibold text-label-sm uppercase tracking-wider">
                    {space.type.replace('_', ' ')}
                  </span>
                  <span className="font-sora text-headline-sm font-bold text-secondary">
                    {space.tarif_horaire} DT <span className="text-body-sm font-normal text-on-surface-variant">/ hr</span>
                  </span>
                </div>
                <div>
                  <h3 className="font-sora text-headline-sm text-primary mb-xs">{space.nom}</h3>
                  <p className="text-body-sm text-on-surface-variant">
                    Capacité : jusqu&apos;à {space.capacite} personnes.
                  </p>
                </div>
              </div>
              <div className="p-lg border-t border-outline-variant/10 bg-surface-container-low flex justify-between items-center">
                <span className="text-body-sm text-on-surface-variant">Disponible aujourd&apos;hui</span>
                <button
                  onClick={() => handleSelectSpace(space.id)}
                  className="bg-primary text-white px-md py-sm rounded-xl font-semibold text-label-sm hover:bg-primary/95 transition-all active:scale-95"
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
