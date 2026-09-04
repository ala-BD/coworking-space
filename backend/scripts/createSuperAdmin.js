// ============================================================
// scripts/createSuperAdmin.js
// Création automatique du compte Super Admin
//
// Email : contact@vclow.com
// Mot de passe : 12345678
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createSuperAdmin() {
  const email    = 'contact@vclow.com';
  const password = '12345678';
  const role     = 'super_admin';

  console.log(`\n👑 Création du compte Super Admin : ${email} ...\n`);

  // 1. Créer ou récupérer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nom: 'Super',
      prenom: 'Admin',
      role: role
    }
  });

  let userId;
  if (authError) {
    if (authError.message.includes('already registered') || authError.message.includes('unique')) {
      console.log('⚠️  Utilisateur Auth existe déjà. Récupération de l\'ID...');
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(u => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
        // Mettre à jour le mot de passe si besoin
        await supabase.auth.admin.updateUserById(userId, { password });
      } else {
        throw authError;
      }
    } else {
      throw authError;
    }
  } else {
    userId = authData.user.id;
    console.log(`✅ Compte Auth créé avec succès (ID: ${userId})`);
  }

  // 2. Mettre à jour / Insérer dans la table profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: email,
      nom: 'Super',
      prenom: 'Admin',
      role: role,
      statut_compte: 'actif'
    });

  if (profileError) {
    console.error('❌ Erreur mise à jour profil :', profileError.message);
  } else {
    console.log('✅ Profil super_admin (statut: actif) mis à jour dans la table profiles');
  }

  console.log('\n════════════════════════════════════════════');
  console.log('🎉 COMPTE SUPER ADMIN PRÊT !');
  console.log(`   📧 Email    : ${email}`);
  console.log(`   🔑 Password : ${password}`);
  console.log(`   🛡️  Role     : ${role}`);
  console.log(`   ⚡ Statut   : actif`);
  console.log('════════════════════════════════════════════\n');
}

createSuperAdmin().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
