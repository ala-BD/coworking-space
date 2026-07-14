// backend/services/notificationService.js
// Module F Dev 2 — Étape F2 — S3
// Service centralisé pour gérer toutes les notifications automatiques
// Email uniquement (SMS prévu mais non implémenté)

const nodemailer = require('nodemailer');
const templates = require('../templates/emailTemplates');

// ── Configuration SMTP ─────────────────────────────────────────────────────
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

// ── Configuration coworking ────────────────────────────────────────────────
function getCoworkingConfig() {
  return {
    coworkingName:    process.env.COWORKING_NAME  || 'Thirty Three Space',
    coworkingEmail:   process.env.COWORKING_EMAIL || 'contact@33space.tn',
    coworkingTel:     process.env.COWORKING_TEL   || '+216 XX XXX XXX',
    coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE — Envoyer une notification
// ══════════════════════════════════════════════════════════════════════════

/**
 * Envoie une notification par email et l'enregistre dans la base de données.
 * 
 * @param {Object} supabase - Client Supabase (service_role)
 * @param {Object} options - Options de notification
 * @param {string} options.type - Type de notification (voir liste ci-dessous)
 * @param {string} options.email - Email du destinataire
 * @param {string} options.userId - ID utilisateur (pour enregistrer dans la table notifications)
 * @param {Object} options.data - Données nécessaires pour générer le template
 * @param {string} [options.subject] - Sujet personnalisé (optionnel, généré auto sinon)
 * 
 * @returns {Promise<Object>} - { success: boolean, messageId: string, error: string }
 */
async function sendNotification(supabase, options) {
  const { type, email, userId, data, subject } = options;
  
  if (!email || !userId || !type) {
    return { success: false, error: 'email, userId et type sont requis' };
  }

  // Vérifier la config SMTP
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP non configuré, notification non envoyée.');
    return { success: false, error: 'SMTP non configuré' };
  }

  const config = getCoworkingConfig();
  const transporter = createTransporter();

  try {
    // 1. Sélectionner le template et générer l'HTML
    const { html, autoSubject } = generateEmailFromType(type, data, config);
    
    if (!html) {
      throw new Error(`Template introuvable pour le type : ${type}`);
    }

    // 2. Envoyer l'email
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
      to: email,
      subject: subject || autoSubject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Notification envoyée à ${email} — Type: ${type} — MessageId: ${info.messageId}`);

    // 3. Enregistrer la notification dans la base de données
    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: type,
        canal: 'Email',
        message: subject || autoSubject,
      });

    if (dbError) {
      console.error('❌ Erreur enregistrement notification dans DB:', dbError.message);
    }

    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error(`❌ Erreur envoi notification (${type}) à ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// GÉNÉRATION HTML SELON LE TYPE DE NOTIFICATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Sélectionne le bon template et génère le HTML selon le type de notification.
 * 
 * @param {string} type - Type de notification
 * @param {Object} data - Données pour le template
 * @param {Object} config - Configuration du coworking
 * @returns {Object} - { html: string, autoSubject: string }
 */
function generateEmailFromType(type, data, config) {
  let html = null;
  let autoSubject = '';

  switch (type) {
    // ────────────────────────────────────────────────────────────────────
    // 1. Nouveau membre
    // ────────────────────────────────────────────────────────────────────
    case 'nouveau_membre':
      html = templates.templateNouveauMembre(data.membre, config);
      autoSubject = `✨ Bienvenue chez ${config.coworkingName} !`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 2. Confirmation réservation
    // ────────────────────────────────────────────────────────────────────
    case 'confirmation_reservation':
      html = templates.templateConfirmationReservation(data.reservation, data.membre, config);
      autoSubject = `✅ Réservation confirmée — ${data.reservation.espaces?.nom || 'Espace'}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 3. Rappel réservation J-1
    // ────────────────────────────────────────────────────────────────────
    case 'rappel_reservation_j1':
      html = templates.templateRappelReservationJ1(data.reservation, data.membre, config);
      autoSubject = `📅 Rappel : Votre réservation est demain`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 4. Session : 15 min avant la fin
    // ────────────────────────────────────────────────────────────────────
    case 'alerte_15min_avant_fin':
      html = templates.templateAlerte15MinAvantFin(data.session, data.membre, config);
      autoSubject = `⏰ Plus que 15 minutes — ${config.coworkingName}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 5. Session : fin du temps réservé
    // ────────────────────────────────────────────────────────────────────
    case 'fin_session':
      html = templates.templateFinSession(data.session, data.membre, config);
      autoSubject = `⏱️ Temps écoulé — Merci de libérer l'espace`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 6. Dépassement de session détecté
    // ────────────────────────────────────────────────────────────────────
    case 'depassement_session':
      html = templates.templateDepassementSession(
        data.session, 
        data.membre, 
        data.minutesDepassement || 0, 
        config
      );
      autoSubject = `🚨 Dépassement de session — ${data.minutesDepassement || 0} minute(s)`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 7. Abonnement expirant (J-7)
    // ────────────────────────────────────────────────────────────────────
    case 'abonnement_expirant_j7':
      html = templates.templateAbonnementExpirantJ7(data.abonnement, data.membre, config);
      autoSubject = `📆 Votre abonnement expire dans 7 jours`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 8. Abonnement expiré
    // ────────────────────────────────────────────────────────────────────
    case 'abonnement_expire':
      html = templates.templateAbonnementExpire(data.abonnement, data.membre, config);
      autoSubject = `⚠️ Votre abonnement a expiré`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 9. Paiement enregistré
    // ────────────────────────────────────────────────────────────────────
    case 'paiement_enregistre':
      html = templates.templatePaiementEnregistre(data.payment, data.membre, config);
      autoSubject = data.payment.statut === 'paid'
        ? `✅ Reçu de paiement ${data.payment.numero_recu || data.payment.id}`
        : `💳 Paiement enregistré ${data.payment.numero_recu || data.payment.id}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 10. Paiement en retard J+3
    // ────────────────────────────────────────────────────────────────────
    case 'paiement_retard_j3':
      html = templates.templatePaiementRetardJ3(data.payment, data.membre, config);
      autoSubject = `💳 Rappel de paiement — ${data.payment.numero_recu || data.payment.id}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 11. Paiement en retard J+7
    // ────────────────────────────────────────────────────────────────────
    case 'paiement_retard_j7':
      html = templates.templatePaiementRetardJ7(data.payment, data.membre, config);
      autoSubject = `⚠️ RAPPEL URGENT — Paiement impayé ${data.payment.numero_recu || data.payment.id}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 12. Annulation de réservation
    // ────────────────────────────────────────────────────────────────────
    case 'annulation_reservation':
      html = templates.templateAnnulationReservation(data.reservation, data.membre, config);
      autoSubject = `🗑️ Réservation annulée — ${data.reservation.espaces?.nom || 'Espace'}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 13. Inscription à une formation
    // ────────────────────────────────────────────────────────────────────
    case 'inscription_formation':
      html = templates.templateInscriptionFormation(data.formation, data.membre, config);
      autoSubject = `🎓 Inscription confirmée — ${data.formation.titre || 'Formation'}`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 14. Rappel formation J-1
    // ────────────────────────────────────────────────────────────────────
    case 'rappel_formation_j1':
      html = templates.templateRappelFormationJ1(data.formation, data.membre, config);
      autoSubject = `🎓 Rappel : Votre formation est demain`;
      break;

    // ────────────────────────────────────────────────────────────────────
    // 15. Nouveau message portail
    // ────────────────────────────────────────────────────────────────────
    case 'nouveau_message_portail':
      html = templates.templateNouveauMessagePortail(data.message, data.expediteur, config);
      autoSubject = `💬 Nouveau message : ${data.message.sujet || 'Message'}`;
      break;

    default:
      console.error(`❌ Type de notification inconnu : ${type}`);
      return { html: null, autoSubject: '' };
  }

  return { html, autoSubject };
}

// ══════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES — Envoi rapide par type
// ══════════════════════════════════════════════════════════════════════════

/**
 * Envoie une notification de bienvenue pour un nouveau membre.
 */
async function notifyNouveauMembre(supabase, membre) {
  return sendNotification(supabase, {
    type: 'nouveau_membre',
    email: membre.email,
    userId: membre.id,
    data: { membre },
  });
}

/**
 * Envoie une confirmation de réservation.
 */
async function notifyConfirmationReservation(supabase, reservation, membre) {
  return sendNotification(supabase, {
    type: 'confirmation_reservation',
    email: membre.email,
    userId: membre.id,
    data: { reservation, membre },
  });
}

/**
 * Envoie un rappel de réservation J-1.
 */
async function notifyRappelReservationJ1(supabase, reservation, membre) {
  return sendNotification(supabase, {
    type: 'rappel_reservation_j1',
    email: membre.email,
    userId: membre.id,
    data: { reservation, membre },
  });
}

/**
 * Envoie une alerte 15 min avant la fin de session.
 */
async function notifyAlerte15MinAvantFin(supabase, session, membre) {
  return sendNotification(supabase, {
    type: 'alerte_15min_avant_fin',
    email: membre.email,
    userId: membre.id,
    data: { session, membre },
  });
}

/**
 * Envoie une notification de fin de session.
 */
async function notifyFinSession(supabase, session, membre) {
  return sendNotification(supabase, {
    type: 'fin_session',
    email: membre.email,
    userId: membre.id,
    data: { session, membre },
  });
}

/**
 * Envoie une alerte de dépassement de session.
 */
async function notifyDepassementSession(supabase, session, membre, minutesDepassement) {
  return sendNotification(supabase, {
    type: 'depassement_session',
    email: membre.email,
    userId: membre.id,
    data: { session, membre, minutesDepassement },
  });
}

/**
 * Envoie un rappel d'abonnement expirant dans 7 jours.
 */
async function notifyAbonnementExpirantJ7(supabase, abonnement, membre) {
  return sendNotification(supabase, {
    type: 'abonnement_expirant_j7',
    email: membre.email,
    userId: membre.id,
    data: { abonnement, membre },
  });
}

/**
 * Envoie une notification d'abonnement expiré.
 */
async function notifyAbonnementExpire(supabase, abonnement, membre) {
  return sendNotification(supabase, {
    type: 'abonnement_expire',
    email: membre.email,
    userId: membre.id,
    data: { abonnement, membre },
  });
}

/**
 * Envoie une notification de paiement enregistré.
 */
async function notifyPaiementEnregistre(supabase, payment, membre) {
  return sendNotification(supabase, {
    type: 'paiement_enregistre',
    email: membre.email,
    userId: membre.id,
    data: { payment, membre },
  });
}

/**
 * Envoie un rappel de paiement en retard J+3.
 */
async function notifyPaiementRetardJ3(supabase, payment, membre) {
  return sendNotification(supabase, {
    type: 'paiement_retard_j3',
    email: membre.email,
    userId: membre.id,
    data: { payment, membre },
  });
}

/**
 * Envoie un rappel urgent de paiement en retard J+7.
 */
async function notifyPaiementRetardJ7(supabase, payment, membre) {
  return sendNotification(supabase, {
    type: 'paiement_retard_j7',
    email: membre.email,
    userId: membre.id,
    data: { payment, membre },
  });
}

/**
 * Envoie une notification d'annulation de réservation.
 */
async function notifyAnnulationReservation(supabase, reservation, membre) {
  return sendNotification(supabase, {
    type: 'annulation_reservation',
    email: membre.email,
    userId: membre.id,
    data: { reservation, membre },
  });
}

/**
 * Envoie une confirmation d'inscription à une formation.
 */
async function notifyInscriptionFormation(supabase, formation, membre) {
  return sendNotification(supabase, {
    type: 'inscription_formation',
    email: membre.email,
    userId: membre.id,
    data: { formation, membre },
  });
}

/**
 * Envoie un rappel de formation J-1.
 */
async function notifyRappelFormationJ1(supabase, formation, membre) {
  return sendNotification(supabase, {
    type: 'rappel_formation_j1',
    email: membre.email,
    userId: membre.id,
    data: { formation, membre },
  });
}

/**
 * Envoie une notification de nouveau message portail (pour l'admin).
 */
async function notifyNouveauMessagePortail(supabase, message, expediteur, adminEmail, adminUserId) {
  return sendNotification(supabase, {
    type: 'nouveau_message_portail',
    email: adminEmail,
    userId: adminUserId,
    data: { message, expediteur },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Fonction principale
  sendNotification,
  
  // Fonctions utilitaires spécifiques
  notifyNouveauMembre,
  notifyConfirmationReservation,
  notifyRappelReservationJ1,
  notifyAlerte15MinAvantFin,
  notifyFinSession,
  notifyDepassementSession,
  notifyAbonnementExpirantJ7,
  notifyAbonnementExpire,
  notifyPaiementEnregistre,
  notifyPaiementRetardJ3,
  notifyPaiementRetardJ7,
  notifyAnnulationReservation,
  notifyInscriptionFormation,
  notifyRappelFormationJ1,
  notifyNouveauMessagePortail,
};
