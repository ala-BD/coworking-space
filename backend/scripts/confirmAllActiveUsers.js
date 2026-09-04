// scripts/confirmAllActiveUsers.js
// Auto-confirme l'email dans Supabase Auth pour tous les utilisateurs actifs ou en attente
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function confirmAllUsers() {
  console.log('🔄 Confirmation de tous les emails utilisateurs...');
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Erreur listUsers:', error.message);
    return;
  }

  for (const u of data.users) {
    if (!u.email_confirmed_at) {
      console.log(`✉️ Confirmation de l'email pour ${u.email} (${u.id})...`);
      await supabase.auth.admin.updateUserById(u.id, { email_confirm: true });
      console.log(`✅ ${u.email} confirmé !`);
    } else {
      console.log(`✓ ${u.email} était déjà confirmé.`);
    }
  }
}

confirmAllUsers().then(() => process.exit(0));
