// config/supabase.js — Clients Supabase partagés
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Variables SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY requises.');
  process.exit(1);
}

// Client admin (service role) — contourne le RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Assurer l'existence du bucket de stockage public pour les images
async function ensureStorageBucket() {
  try {
    const { data, error } = await supabaseAdmin.storage.createBucket('coworking-images', { public: true });
    if (error) {
      // Si le bucket existe déjà, Supabase renvoie un message d'erreur qu'on peut ignorer
      if (error.message && (error.message.includes('already exists') || error.message.includes('Duplicate'))) {
        console.log('✅ Bucket "coworking-images" déjà présent.');
      } else {
        console.warn('⚠️ Bucket "coworking-images" non créé:', error.message);
      }
    } else {
      console.log('🚀 Bucket "coworking-images" créé avec succès.');
    }
  } catch (err) {
    console.warn('⚠️ Impossible de créer/vérifier le bucket storage:', err.message);
  }
}
ensureStorageBucket();

// Crée un client user authentifié à partir du token JWT
function getUserClient(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

module.exports = { supabaseAdmin, getUserClient, supabaseUrl, supabaseAnonKey, supabaseServiceKey };
