// backend/test/testReservationCron.js
// Test des fonctions de notification pour les réservations
// Usage : node backend/test/testReservationCron.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  notifyRappelReservation,
  notifyAlerte15MinAvantFin,
  notifyFinSession,
  notifyDepassementSession
} = require('../services/notificationService');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Test des notifications de réservation Module F\n');

async function testReservationNotifications() {
  console.log('📅 Test 1 : Rappel réservation J-1');
  try {
    await notifyRappelReservation(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000', // UUID de test
      reservationId: 'test-resa-001',
      espaceNom: 'Bureau Open Space',
      dateDebut: '2026-07-21T09:00:00Z',
      dateFin: '2026-07-21T17:00:00Z',
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Rappel J-1 : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur rappel J-1:', err.message, '\n');
  }

  console.log('⏰ Test 2 : Alerte 15 minutes avant fin');
  try {
    await notifyAlerte15MinAvantFin(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      sessionId: 'test-session-001',
      espaceNom: 'Salle de Réunion',
      heureFin: '2026-07-20T17:00:00Z',
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Alerte 15 min : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur alerte 15 min:', err.message, '\n');
  }

  console.log('✅ Test 3 : Notification fin de session');
  try {
    await notifyFinSession(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      sessionId: 'test-session-002',
      espaceNom: 'Bureau Privé',
      heureDebut: '2026-07-20T09:00:00Z',
      heureFin: '2026-07-20T17:00:00Z',
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Fin de session : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur fin de session:', err.message, '\n');
  }

  console.log('⚠️ Test 4 : Dépassement horaire');
  try {
    await notifyDepassementSession(supabaseAdmin, {
      userId: '00000000-0000-0000-0000-000000000000',
      sessionId: 'test-session-003',
      espaceNom: 'Open Space',
      heureFin: '2026-07-20T17:00:00Z',
      minutesDepassement: 25,
      userName: 'Ahmed Ben Ali',
      userEmail: 'test@example.com'
    });
    console.log('✅ Dépassement : Email envoyé + notification enregistrée\n');
  } catch (err) {
    console.error('❌ Erreur dépassement:', err.message, '\n');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Tests terminés !');
  console.log('Vérifiez :');
  console.log('  1. backend/test/output-emails/ (si SMTP non configuré)');
  console.log('  2. Votre boîte email de test (si SMTP configuré)');
  console.log('  3. Table notifications dans Supabase');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

testReservationNotifications();
