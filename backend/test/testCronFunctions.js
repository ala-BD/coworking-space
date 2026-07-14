// backend/test/testCronFunctions.js
// Test simple des fonctions de notification Module F
// Usage : node backend/test/testCronFunctions.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  notifyRappelReservationJ1,
  notifyAlerte15MinAvantFin,
  notifyFinSession,
  notifyDepassementSession,
  notifyAbonnementExpirantJ7,
  notifyAbonnementExpire
} = require('../services/notificationService');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 TEST MODULE F — Fonctions de notification\n');
console.log('═══════════════════════════════════════════════════\n');

async function runTests() {
  // Mock data
  const mockReservation = {
    id: 'test-resa-001',
    date_debut: '2026-07-21T09:00:00Z',
    date_fin: '2026-07-21T17:00:00Z',
    espaces: { nom: 'Bureau Open Space', type: 'open_space' }
  };

  const mockSession = {
    id: 'test-session-001',
    heure_debut: '2026-07-20T09:00:00Z',
    heure_fin: '2026-07-20T17:00:00Z',
    espaces: { nom: 'Salle de Réunion', type: 'meeting_room' }
  };

  const mockAbonnement = {
    id: 'test-abo-001',
    type: 'mensuel',
    date_fin: new Date(Date.now() + 7 * 24 * 3600000).toISOString() // Dans 7 jours
  };

  const mockMembre = {
    id: '00000000-0000-0000-0000-000000000000',
    nom: 'Ben Ali',
    prenom: 'Ahmed',
    email: 'test@example.com'
  };

  console.log('📅 Test 1 : Rappel réservation J-1');
  try {
    const result = await notifyRappelReservationJ1(supabaseAdmin, mockReservation, mockMembre);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('⏰ Test 2 : Alerte 15 minutes avant fin');
  try {
    const result = await notifyAlerte15MinAvantFin(supabaseAdmin, mockSession, mockMembre);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('✅ Test 3 : Notification fin de session');
  try {
    const result = await notifyFinSession(supabaseAdmin, mockSession, mockMembre);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('⚠️  Test 4 : Dépassement horaire');
  try {
    const result = await notifyDepassementSession(supabaseAdmin, mockSession, mockMembre, 25);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('📆 Test 5 : Rappel abonnement J-7');
  try {
    const result = await notifyAbonnementExpirantJ7(supabaseAdmin, mockAbonnement, mockMembre);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('⚠️  Test 6 : Abonnement expiré');
  try {
    const mockAbonnementExpire = { ...mockAbonnement, date_fin: new Date(Date.now() - 24 * 3600000).toISOString() };
    const result = await notifyAbonnementExpire(supabaseAdmin, mockAbonnementExpire, mockMembre);
    console.log(result.success ? '✅ SUCCÈS' : '❌ ÉCHEC :', result.error || '');
  } catch (err) {
    console.error('❌ ERREUR :', err.message);
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Tests terminés !');
  console.log('');
  console.log('📋 Vérifications à faire :');
  console.log('  1. Si SMTP configuré → Vérifier votre boîte email');
  console.log('  2. Si SMTP non configuré → Les emails sont affichés dans la console');
  console.log('  3. Vérifier la table notifications dans Supabase');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
