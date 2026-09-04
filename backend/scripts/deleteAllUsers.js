// ============================================================
// scripts/deleteAllUsers.js
// Supprime TOUS les utilisateurs de Supabase Auth + leurs profils
//
// ⚠️  ATTENTION : Action IRRÉVERSIBLE !
//     Tous les comptes (membres, admins, super_admin) seront supprimés.
//
// Usage :
//   node backend/scripts/deleteAllUsers.js
//   node backend/scripts/deleteAllUsers.js --dry-run   (simulation sans suppression)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl  = process.env.SUPABASE_URL;
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Suppression via API REST directe (plus fiable que le SDK)
async function deleteUserById(userId) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} — ${body}`);
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

async function getAllUsers() {
  let allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Erreur listUsers page ${page}: ${error.message}`);
    if (!data.users || data.users.length === 0) break;

    allUsers = allUsers.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  return allUsers;
}

async function deleteAllUsers() {
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('  🗑️  SUPPRESSION DE TOUS LES UTILISATEURS  ');
  if (DRY_RUN) console.log('  🔍  MODE SIMULATION (--dry-run)            ');
  console.log('════════════════════════════════════════════');
  console.log('');

  // 1. Récupérer tous les utilisateurs
  console.log('📋 Récupération de la liste des utilisateurs...');
  let users;
  try {
    users = await getAllUsers();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log('✅ Aucun utilisateur trouvé dans la base. Rien à supprimer.');
    return;
  }

  console.log(`\n👥 ${users.length} utilisateur(s) trouvé(s) :\n`);
  users.forEach((u, i) => {
    console.log(`   ${i + 1}. [${u.id}] ${u.email || '(pas d\'email)'} — rôle: ${u.user_metadata?.role || 'N/A'}`);
  });

  if (DRY_RUN) {
    console.log('\n🔍 Mode simulation : aucun utilisateur supprimé.');
    console.log('   Relancez sans --dry-run pour effectuer la suppression réelle.');
    return;
  }

  // 2. Confirmation (délai de sécurité)
  console.log('\n⚠️  Suppression dans 3 secondes... (Ctrl+C pour annuler)');
  await new Promise(r => setTimeout(r, 3000));

  // 3. Supprimer un par un
  console.log('\n🗑️  Suppression en cours...\n');
  let success = 0;
  let failed  = 0;

  for (const user of users) {
    try {
      await deleteUserById(user.id);
      console.log(`   ✅ Supprimé [${user.email}]`);
      success++;
    } catch (err) {
      console.error(`   ❌ Échec  [${user.email}] : ${err.message}`);
      failed++;
    }
  }

  // 4. Bilan
  console.log('\n════════════════════════════════════════════');
  console.log(`  ✅ Supprimés avec succès : ${success}`);
  if (failed > 0)
  console.log(`  ❌ Échecs               : ${failed}`);
  console.log('════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 Tous les utilisateurs ont été supprimés.');
    console.log('   Les profils associés sont automatiquement supprimés');
    console.log('   grâce à la cascade ON DELETE CASCADE de la table profiles.\n');
  } else {
    console.log('⚠️  Certains utilisateurs n\'ont pas pu être supprimés.');
    console.log('   Vérifiez les erreurs ci-dessus.\n');
  }
}

deleteAllUsers().catch(err => {
  console.error('❌ Erreur inattendue :', err.message);
  process.exit(1);
});
