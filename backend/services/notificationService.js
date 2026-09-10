// backend/services/notificationService.js
// Module F Dev 2 — Étape F2 — S3
// Service centralisé pour gérer toutes les notifications automatiques
// Email uniquement (SMS prévu mais non implémenté)

const path = require('path');
const fs = require('fs');
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

// ── Pièces jointes globales (Logo DeskyWork officiel en CID pour mode clair & sombre) ──
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

// ── Configuration coworking ────────────────────────────────────────────────
function getCoworkingConfig() {
  return {
    appName:          'DeskyWork',
    coworkingName:    process.env.COWORKING_NAME  || 'DeskyWork',
    coworkingEmail:   process.env.COWORKING_EMAIL || 'contact@33space.tn',
    coworkingTel:     process.env.COWORKING_TEL   || '+216 XX XXX XXX',
    coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
    frontendUrl:      process.env.FRONTEND_URL    || 'http://localhost:5173',
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

  const config = getCoworkingConfig();

  // 1. Générer le sujet + HTML (indépendant du SMTP)
  let html = null;
  let autoSubject = type;
  try {
    const gen = generateEmailFromType(type, data, config);
    html = gen.html;
    autoSubject = gen.autoSubject;
  } catch (genErr) {
    console.error(`❌ Erreur génération template (${type}) :`, genErr.message);
  }

  const message = subject || autoSubject || type;

  // 2. Toujours enregistrer la notification en base (traçabilité + portail membre)
  try {
    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: type,
        canal: 'Email',
        message: message,
      });

    if (dbError) {
      console.error('❌ Erreur enregistrement notification dans DB:', dbError.message);
    }
  } catch (dbErr) {
    console.error('❌ Erreur enregistrement notification dans DB:', dbErr.message);
  }

  // 3. Envoyer l'email (échec non bloquant — la notification est déjà en base)
  if (!html) {
    console.warn(`⚠️ Template introuvable pour le type : ${type} — notification enregistrée en base.`);
    return { success: false, error: `Template introuvable : ${type}`, dbRecorded: true };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP non configuré, email non envoyé — notification enregistrée en base.');
    return { success: false, error: 'SMTP non configuré', dbRecorded: true };
  }

  const transporter = createTransporter();
  const attachments = getMailAttachments();
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
    to: email,
    subject: subject || autoSubject,
    html: html,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Notification envoyée à ${email} — Type: ${type} — MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, dbRecorded: true };
  } catch (err) {
    console.error(`❌ Erreur envoi email (${type}) à ${email}:`, err.message);
    return { success: false, error: err.message, dbRecorded: true };
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
    // 1b. Nouveau formateur
    // ────────────────────────────────────────────────────────────────────
    case 'nouveau_formateur':
      html = templates.templateNouveauFormateur(data.formateur, config);
      autoSubject = `✨ Votre compte formateur est prêt chez ${config.coworkingName}`;
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

    // ────────────────────────────────────────────────────────────────────
    // 16. Nouvelle formation disponible
    // ────────────────────────────────────────────────────────────────────
    case 'nouvelle_formation':
      html = templates.templateNouvelleFormation(data.formation, data.membre, config);
      autoSubject = `🎓 Nouvelle formation disponible : ${data.formation?.titre || 'Formation'}`;
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

async function notifyNouveauFormateur(supabase, formateur) {
  return sendNotification(supabase, {
    type: 'nouveau_formateur',
    email: formateur.email,
    userId: formateur.id,
    data: { formateur },
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

/**
 * Envoie une notification pour une nouvelle formation à un membre individuel.
 */
async function notifyNouvelleFormation(supabase, formation, membre) {
  return sendNotification(supabase, {
    type: 'nouvelle_formation',
    email: membre.email,
    userId: membre.id,
    data: { formation, membre },
  });
}

/**
 * Diffuse une notification de nouvelle formation à tous les membres (étudiant, entreprise, individuel)
 * d'un coworking (ou de la plateforme).
 */
async function broadcastNouvelleFormation(supabase, formation) {
  try {
    const titre = formation.titre || 'Nouvelle Formation';
    const formateurNom = formation.profiles
      ? `${formation.profiles.prenom || ''} ${formation.profiles.nom || ''}`.trim()
      : 'Formateur';
    
    let dateStr = '';
    if (formation.date_debut) {
      const d = new Date(formation.date_debut);
      dateStr = ` le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Récupérer tous les membres actifs du coworking (étudiant, entreprise, individuel)
    let query = supabase
      .from('profiles')
      .select('id, email, nom, prenom, type_membre')
      .in('role', ['member', 'guest']);

    if (formation.tenant_id) {
      query = query.or(`tenant_id.eq.${formation.tenant_id},tenant_id.is.null`);
    }

    const { data: members, error } = await query;
    if (error || !members || members.length === 0) {
      console.log('ℹ️ Aucun membre à notifier pour la nouvelle formation.');
      return { count: 0 };
    }

    const message = `🎓 Nouvelle formation : « ${titre} » par ${formateurNom}${dateStr}. ${formation.description ? formation.description.slice(0, 120) + (formation.description.length > 120 ? '...' : '') : ''}`.trim();

    // 1. Enregistrement en masse des notifications dans la base de données
    const notifRows = members.map((m) => ({
      user_id: m.id,
      type: 'nouvelle_formation',
      canal: 'Email',
      message: message,
      lu: false,
    }));

    const { error: insertErr } = await supabase.from('notifications').insert(notifRows);
    if (insertErr) {
      console.error('❌ Erreur insertion notifications nouvelle formation:', insertErr.message);
    } else {
      console.log(`✅ ${notifRows.length} notification(s) de formation enregistrée(s) en DB.`);
    }

    // 2. Envoi des emails en tâche asynchrone non-bloquante
    const config = getCoworkingConfig();
    const attachments = getMailAttachments();
    members.forEach((m) => {
      if (m.email) {
        try {
          const gen = generateEmailFromType('nouvelle_formation', { formation, membre: m }, config);
          if (gen?.html && process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = createTransporter();
            transporter.sendMail({
              from: process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
              to: m.email,
              subject: gen.autoSubject || `🎓 Nouvelle formation disponible : ${titre}`,
              html: gen.html,
              attachments: attachments.length > 0 ? attachments : undefined,
            }).catch((err) => console.warn(`⚠️ Erreur email formation vers ${m.email}:`, err.message));
          }
        } catch (e) {
          console.warn(`⚠️ Erreur génération email formation pour ${m.email}:`, e.message);
        }
      }
    });

    return { count: members.length };
  } catch (err) {
    console.error('❌ Erreur broadcastNouvelleFormation:', err.message);
    return { count: 0, error: err.message };
  }
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
  notifyNouveauFormateur,
  notifyNouveauMessagePortail,
  notifyNouvelleFormation,
  broadcastNouvelleFormation,
};
