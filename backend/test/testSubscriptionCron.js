// backend/test/testSubscriptionCron.js
// Test des fonctions de notification pour les abonnements
// Usage : node backend/test/testSubscriptionCron.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  notifyAbonnementExpirantJ7,
  notifyAbonnementExpire
} = require('../services/notificationService');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Test des notifications d\'abonnement Module F\n');

async function testSubscriptionNotifications() {
  console.log('📆 Test 1 : Rappel abonnement expirant J-7');
  try {
    const dateFin = new Date();
    dateFin.setDate(dateFin.getDate() + 7);

    await notifyAbonnementExpirantJ7(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      abonnementId: 'test-abo-001',
      typeAbonnement: 'mensuel',
      dateFin: dateFin.toISOString(),
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Rappel J-7 : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur rappel J-7:', err.message, '\n');
  }

  console.log('📆 Test 2 : Rappel abonnement expirant J-3');
  try {
    const dateFin = new Date();
    dateFin.setDate(dateFin.getDate() + 3);

    await notifyAbonnementExpirantJ7(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      abonnementId: 'test-abo-002',
      typeAbonnement: 'week_pass',
      dateFin: dateFin.toISOString(),
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com',
      joursRestants: 3
    });
    console.log('✅ Rappel J-3 : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur rappel J-3:', err.message, '\n');
  }

  console.log('⚠️ Test 3 : Abonnement expiré');
  try {
    const dateFin = new Date();
    dateFin.setDate(dateFin.getDate() - 1); // Hier

    await notifyAbonnementExpire(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      abonnementId: 'test-abo-003',
      typeAbonnement: 'day_pass',
      dateFin: dateFin.toISOString(),
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Abonnement expiré : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur abonnement expiré:', err.message, '\n');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Tests terminés !');
  console.log('Vérifiez :');
  console.log('  1. backend/test/output-emails/ (si SMTP non configuré)');
  console.log('  2. Votre boîte email de test (si SMTP configuré)');
  console.log('  3. Table notifications dans Supabase');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('📊 Statistiques des notifications :');
  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select('type, canal, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!error && notifs) {
    console.log(`  Total : ${notifs.length} dernières notifications`);
    notifs.forEach((n, i) => {
      console.log(`  ${i + 1}. [${n.canal}] ${n.type} - ${new Date(n.created_at).toLocaleString('fr-FR')}`);
    });
  }

  process.exit(0);
}

testSubscriptionNotifications();
