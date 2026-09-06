// scripts/inspectReservations.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function inspect() {
  console.log('🔍 Inspecting reservations table...');
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, user_id, guest_id, espace_id, date_debut, date_fin, statut, espaces(nom, tarif_horaire)');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Found ${reservations?.length || 0} reservations:`);
  console.log(JSON.stringify(reservations, null, 2));

  const { data: profiles } = await supabase.from('profiles').select('id, email, nom, prenom');
  console.log('\nUsers profiles:');
  console.log(JSON.stringify(profiles, null, 2));
}

inspect().then(() => process.exit(0));
