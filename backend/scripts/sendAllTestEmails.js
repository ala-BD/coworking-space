// backend/scripts/sendAllTestEmails.js
// Envoie les 17 types d'emails de notification à l'adresse indiquée pour test
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const nodemailer = require('nodemailer');
const templates = require('../templates/emailTemplates');

const TARGET_EMAIL = 'alabendawed@gmail.com';

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function getMailAttachments() {
  const lightLogoPath = path.join(__dirname, '../assets/deskywork-logo-light.png');
  const darkLogoPath = path.join(__dirname, '../assets/deskywork-logo-dark.png');
  const attachments = [];
  if (fs.existsSync(lightLogoPath)) {
    attachments.push({
      filename: 'deskywork-logo-light.png',
      path: lightLogoPath,
      cid: 'deskywork-logo-light',
    });
  }
  if (fs.existsSync(darkLogoPath)) {
    attachments.push({
      filename: 'deskywork-logo-dark.png',
      path: darkLogoPath,
      cid: 'deskywork-logo-dark',
    });
  }
  return attachments;
}

const config = {
  appName:          'DeskyWork',
  coworkingName:    process.env.COWORKING_NAME  || 'DeskyWork Hub',
  coworkingEmail:   process.env.COWORKING_EMAIL || 'contact@deskywork.tn',
  coworkingTel:     process.env.COWORKING_TEL   || '+216 71 000 000',
  coworkingAdresse: process.env.COWORKING_ADRESSE || 'Les Berges du Lac 2, Tunis',
  frontendUrl:      process.env.FRONTEND_URL    || 'http://localhost:5173',
};

const mockMembre = {
  id: 'usr-123456',
  prenom: 'Ala',
  nom: 'Ben Dawed',
  email: TARGET_EMAIL,
  type_membre: 'individuel',
};

const mockFormateur = {
  id: 'usr-formateur-01',
  prenom: 'Ala',
  nom: 'Ben Dawed',
  email: TARGET_EMAIL,
  specialite: 'Full-Stack Development & DevOps',
};

const mockReservation = {
  id: 'res-8829',
  code_reservation: 'RES-2026-8829',
  date_debut: new Date(Date.now() + 86400000).toISOString(),
  date_fin: new Date(Date.now() + 86400000 + 4 * 3600000).toISOString(),
  mode: 'en_ligne',
  montant: 45.0,
  espaces: {
    nom: 'Bureau Privé Titanium #4',
    type: 'bureau_prive',
  },
};

const mockSession = {
  id: 'sess-409',
  date_debut: new Date(Date.now() - 3600000).toISOString(),
  date_fin: new Date(Date.now() + 900000).toISOString(),
  espaces: { nom: 'Open Space - Poste Flex #12' },
};

const mockAbonnement = {
  id: 'sub-301',
  type_forfait: 'Pass Illimité Pro',
  date_fin: new Date(Date.now() + 7 * 86400000).toISOString(),
  montant_mensuel: 250,
};

const mockPayment = {
  id: 'pay-77492',
  numero_recu: 'REC-2026-00482',
  montant: 180.0,
  mode: 'online',
  mode_paiement: 'Carte bancaire (Stripe)',
  date_paiement: new Date().toISOString(),
  statut: 'paid',
  description: 'Réservation Bureau Privé + Service Café Premium',
};

const mockFormation = {
  id: 'form-102',
  titre: 'Intelligence Artificielle & Automatisation pour Entreprises',
  description: 'Une formation intensive de 6 heures pour maîtriser les outils IA modernes, intégrer des APIs intelligentes et automatiser vos flux de travail.',
  date_debut: new Date(Date.now() + 2 * 86400000).toISOString(),
  date_fin: new Date(Date.now() + 2 * 86400000 + 6 * 3600000).toISOString(),
  prix: 120,
  places_disponibles: 15,
  salle: 'Salle Innovation Alpha',
  profiles: {
    prenom: 'Karim',
    nom: 'Mezghani',
  },
};

const mockMessage = {
  id: 'msg-99',
  sujet: 'Confirmation de vos équipements pour la réunion de demain',
  contenu: 'Bonjour Ala, nous avons bien préparé les 2 écrans 4K et le système de visioconférence dans votre salle. N\'hésitez pas si vous avez besoin d\'assistance !',
};

const mockExpediteur = {
  prenom: 'Équipe',
  nom: 'Support DeskyWork',
  email: 'support@deskywork.tn',
};

// Liste des 17 tests d'emails
const testCases = [
  {
    type: '1. Nouveau membre',
    subject: `[TEST 1/17] ✨ Bienvenue chez ${config.coworkingName} !`,
    html: templates.templateNouveauMembre(mockMembre, config),
  },
  {
    type: '1b. Nouveau formateur',
    subject: `[TEST 2/17] ✨ Votre compte formateur est prêt chez ${config.coworkingName}`,
    html: templates.templateNouveauFormateur(mockFormateur, config),
  },
  {
    type: '2. Confirmation réservation',
    subject: `[TEST 3/17] ✅ Réservation confirmée — ${mockReservation.espaces.nom}`,
    html: templates.templateConfirmationReservation(mockReservation, mockMembre, config),
  },
  {
    type: '3. Rappel réservation J-1',
    subject: `[TEST 4/17] 📅 Rappel : Votre réservation est demain`,
    html: templates.templateRappelReservationJ1(mockReservation, mockMembre, config),
  },
  {
    type: '4. Alerte 15min avant fin',
    subject: `[TEST 5/17] ⏰ Plus que 15 minutes — ${config.coworkingName}`,
    html: templates.templateAlerte15MinAvantFin(mockSession, mockMembre, config),
  },
  {
    type: '5. Fin de session',
    subject: `[TEST 6/17] ⏱️ Temps écoulé — Merci de libérer l'espace`,
    html: templates.templateFinSession(mockSession, mockMembre, config),
  },
  {
    type: '6. Dépassement session',
    subject: `[TEST 7/17] 🚨 Dépassement de session — 20 minute(s)`,
    html: templates.templateDepassementSession(mockSession, mockMembre, 20, config),
  },
  {
    type: '7. Abonnement expirant J-7',
    subject: `[TEST 8/17] 📆 Votre abonnement expire dans 7 jours`,
    html: templates.templateAbonnementExpirantJ7(mockAbonnement, mockMembre, config),
  },
  {
    type: '8. Abonnement expiré',
    subject: `[TEST 9/17] ⚠️ Votre abonnement a expiré`,
    html: templates.templateAbonnementExpire(mockAbonnement, mockMembre, config),
  },
  {
    type: '9. Reçu de paiement',
    subject: `[TEST 10/17] ✅ Reçu de paiement ${mockPayment.numero_recu}`,
    html: templates.templatePaiementEnregistre(mockPayment, mockMembre, config),
  },
  {
    type: '10. Paiement retard J+3',
    subject: `[TEST 11/17] 💳 Rappel de paiement — ${mockPayment.numero_recu}`,
    html: templates.templatePaiementRetardJ3(mockPayment, mockMembre, config),
  },
  {
    type: '11. Paiement retard J+7',
    subject: `[TEST 12/17] ⚠️ RAPPEL URGENT — Paiement impayé ${mockPayment.numero_recu}`,
    html: templates.templatePaiementRetardJ7(mockPayment, mockMembre, config),
  },
  {
    type: '12. Annulation réservation',
    subject: `[TEST 13/17] 🗑️ Réservation annulée — ${mockReservation.espaces.nom}`,
    html: templates.templateAnnulationReservation(mockReservation, mockMembre, config),
  },
  {
    type: '13. Inscription formation',
    subject: `[TEST 14/17] 🎓 Inscription confirmée — ${mockFormation.titre}`,
    html: templates.templateInscriptionFormation(mockFormation, mockMembre, config),
  },
  {
    type: '14. Rappel formation J-1',
    subject: `[TEST 15/17] 🎓 Rappel : Votre formation est demain`,
    html: templates.templateRappelFormationJ1(mockFormation, mockMembre, config),
  },
  {
    type: '15. Nouveau message portail',
    subject: `[TEST 16/17] 💬 Nouveau message : ${mockMessage.sujet}`,
    html: templates.templateNouveauMessagePortail(mockMessage, mockExpediteur, config),
  },
  {
    type: '16. Nouvelle formation disponible',
    subject: `[TEST 17/17] 🎓 Nouvelle formation disponible : ${mockFormation.titre}`,
    html: templates.templateNouvelleFormation(mockFormation, mockMembre, config),
  },
];

async function run() {
  console.log(`🚀 Début de l'envoi des ${testCases.length} emails de test vers ${TARGET_EMAIL}...`);
  const transporter = createTransporter();
  const attachments = getMailAttachments();
  console.log(`📎 Pièces jointes (Logo CID):`, attachments.map(a => a.cid));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const item = testCases[i];
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
        to: TARGET_EMAIL,
        subject: item.subject,
        html: item.html,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      console.log(`✅ [${i + 1}/${testCases.length}] Envoyé: ${item.type} (MessageId: ${info.messageId})`);
      successCount++;
      // Petit délai de 400ms pour éviter le rate-limiting SMTP Gmail
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`❌ [${i + 1}/${testCases.length}] Échec pour ${item.type}:`, err.message);
      failCount++;
    }
  }

  console.log(`\n🎉 Terminé : ${successCount} emails envoyés avec succès, ${failCount} échecs.`);
}

run();
