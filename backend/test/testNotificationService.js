// backend/test/testNotificationService.js
// Test du service de notifications (Module F — Étape F2)
// Usage : node backend/test/testNotificationService.js

require('dotenv').config();
const { sendNotification } = require('../services/notificationService');

console.log('🧪 TEST DU SERVICE DE NOTIFICATIONS — MODULE F\n');
console.log('═'.repeat(70));

// Mock Supabase (pour test sans vraie DB)
const mockSupabase = {
  from: () => ({
    insert: async () => ({ error: null }),
  }),
};

// Données de test
const testData = {
  type: 'confirmation_reservation',
  email: process.env.TEST_EMAIL || 'test@example.com',
  userId: 'test-user-id-123',
  data: {
    reservation: {
      id: 'test-reservation-1',
      date_debut: new Date('2026-07-25T09:00:00'),
      date_fin: new Date('2026-07-25T17:00:00'),
      espaces: {
        nom: 'Open Space - Niveau 1',
        type: 'open_space',
      },
    },
    membre: {
      id: 'test-membre-1',
      prenom: 'Ahmed',
      nom: 'Ben Salah',
      email: process.env.TEST_EMAIL || 'test@example.com',
      telephone: '+216 20 123 456',
    },
  },
};

// Test
async function runTest() {
  console.log('\n📧 Envoi d\'une notification de test...\n');
  console.log(`Type        : ${testData.type}`);
  console.log(`Destinataire: ${testData.email}\n`);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️  SMTP non configuré dans .env — Test annulé.');
    console.log('   Ajoutez SMTP_USER et SMTP_PASS dans backend/.env\n');
    process.exit(1);
  }

  const result = await sendNotification(mockSupabase, testData);

  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 RÉSULTAT DU TEST\n');

  if (result.success) {
    console.log('✅ SUCCESS !');
    console.log(`   MessageId : ${result.messageId}`);
    console.log(`   Email envoyé à ${testData.email}\n`);
    console.log('💡 Vérifiez votre boîte email pour confirmer la réception.\n');
    process.exit(0);
  } else {
    console.log('❌ ÉCHEC !');
    console.log(`   Erreur : ${result.error}\n`);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('\n❌ ERREUR CRITIQUE :', err.message, '\n');
  process.exit(1);
});
