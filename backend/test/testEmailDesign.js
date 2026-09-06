/**
 * testEmailDesign.js — Test d'envoi email avec le nouveau design DeskyWork
 * ─────────────────────────────────────────────────────────────────────────
 * Usage :
 *   TEST_EMAIL=ton@email.com node backend/test/testEmailDesign.js
 *
 * Prérequis : configurer SMTP_HOST, SMTP_USER, SMTP_PASS dans .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const nodemailer  = require('nodemailer');
const templates   = require('../templates/emailTemplates');

// ─── Destinataire ────────────────────────────────────────────────────────────
const TO_EMAIL = process.env.TEST_EMAIL;

if (!TO_EMAIL) {
  console.error('\n❌  Variable TEST_EMAIL manquante.');
  console.error('   Usage : TEST_EMAIL=ton@email.com node backend/test/testEmailDesign.js\n');
  process.exit(1);
}

// ─── Config coworking ────────────────────────────────────────────────────────
const config = {
  appName:          'DeskyWork',
  coworkingName:    process.env.COWORKING_NAME    || 'DeskyWork Coworking',
  coworkingEmail:   process.env.COWORKING_EMAIL   || 'contact@deskywork.tn',
  coworkingTel:     process.env.COWORKING_TEL     || '+216 99 999 999',
  coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
};

// ─── Données de test ─────────────────────────────────────────────────────────
const testMembre = {
  id:     'test-uuid-001',
  prenom: 'Ala',
  nom:    'Ben Ahmed',
  email:  TO_EMAIL,
};

const testReservation = {
  id:         'res-test-001',
  date_debut: new Date(Date.now() + 86400000).toISOString(), // demain
  date_fin:   new Date(Date.now() + 86400000 + 7200000).toISOString(), // +2h
  mode:       'sur_place',
  espaces:    { nom: 'Suite Premium 01', type: 'meeting_room' },
};

// ─── Transporter SMTP ────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Envoi ───────────────────────────────────────────────────────────────────
async function sendTestEmails() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('\n❌  SMTP_USER ou SMTP_PASS manquants dans .env\n');
    process.exit(1);
  }

  const transporter = createTransporter();

  // Vérifier la connexion SMTP
  try {
    await transporter.verify();
    console.log('\n✅  Connexion SMTP OK\n');
  } catch (e) {
    console.error('\n❌  Connexion SMTP échouée :', e.message);
    process.exit(1);
  }

  const emailsToSend = [
    {
      label:   '1. Bienvenue nouveau membre',
      subject: '✨ Bienvenue sur DeskyWork !',
      html:    templates.templateNouveauMembre(testMembre, config),
    },
    {
      label:   '2. Confirmation de réservation',
      subject: '✅ Réservation confirmée — Suite Premium 01',
      html:    templates.templateConfirmationReservation(testReservation, testMembre, config),
    },
    {
      label:   '3. Annulation de réservation',
      subject: '🗑️ Réservation annulée — Suite Premium 01',
      html:    templates.templateAnnulationReservation(testReservation, testMembre, config),
    },
    {
      label:   '4. Rappel réservation J-1',
      subject: '📅 Rappel : votre réservation est demain',
      html:    templates.templateRappelReservationJ1(testReservation, testMembre, config),
    },
    {
      label:   '5. Abonnement expirant J-7',
      subject: '📆 Votre abonnement expire dans 7 jours',
      html:    templates.templateAbonnementExpirantJ7(
        { type: 'mensuel', date_fin: new Date(Date.now() + 7 * 86400000).toISOString() },
        testMembre,
        config
      ),
    },
    {
      label:   '6. Paiement enregistré',
      subject: '✅ Reçu de paiement — REC-2025-001234',
      html:    templates.templatePaiementEnregistre(
        { id: 'pay-001', montant: 75.000, statut: 'paid', numero_recu: 'REC-2025-001234' },
        testMembre,
        config
      ),
    },
  ];

  console.log(`📧  Envoi de ${emailsToSend.length} emails de test à : ${TO_EMAIL}\n`);
  console.log('─'.repeat(55));

  let sent = 0;
  let failed = 0;

  for (const em of emailsToSend) {
    try {
      const info = await transporter.sendMail({
        from:    `"${config.coworkingName}" <${process.env.SMTP_USER}>`,
        to:      TO_EMAIL,
        subject: em.subject,
        html:    em.html,
      });
      console.log(`  ✅  ${em.label}`);
      console.log(`       MessageId: ${info.messageId}`);
      sent++;
    } catch (e) {
      console.error(`  ❌  ${em.label}`);
      console.error(`       Erreur: ${e.message}`);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(55));
  console.log(`  Résultats : ${sent} ✅ envoyé(s)  /  ${failed} ❌ échoué(s)`);
  console.log(`  Destinataire : ${TO_EMAIL}`);
  console.log('═'.repeat(55) + '\n');

  if (failed > 0) process.exit(1);
}

sendTestEmails().catch(e => {
  console.error('Erreur inattendue :', e.message);
  process.exit(1);
});
