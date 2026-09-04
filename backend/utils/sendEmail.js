// backend/utils/sendEmail.js
// Service d'envoi d'emails — Module C Dev 2 — Étape 4
// Utilise Nodemailer (SMTP configurable via .env)

const nodemailer = require('nodemailer');

// ── Configuration du transporteur SMTP ──────────────────────────────────────
function createTransporter() {
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const isGmail = (process.env.SMTP_HOST || '').includes('gmail') || (process.env.SMTP_USER || '').endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: pass,
      },
    });
  }

  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true pour port 465, false pour 587
    auth: {
      user: process.env.SMTP_USER,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

// ── Palette couleurs (DeskyWork : Noir, Orange, Blanc) ───────────────────────
const PRIMARY   = '#100F0D';
const SECONDARY = '#F95D00';
const ACCENT    = '#F95D00';
const LIGHT     = '#FFF7ED';
const MUTED     = '#6B7280';
const SUCCESS   = '#059669';
const WARNING   = '#D97706';
const WHITE     = '#FFFFFF';

// ── Labels ───────────────────────────────────────────────────────────────────
const MODE_LABELS = {
  cash:          'Espèces',
  bank_transfer: 'Virement bancaire',
  check:         'Chèque',
  online:        'Paiement en ligne',
};

const STATUT_COLORS = {
  paid:     SUCCESS,
  pending:  WARNING,
  failed:   '#DC2626',
  refunded: '#7C3AED',
};

const STATUT_LABELS = {
  paid:     'Payé ✓',
  pending:  'En attente',
  failed:   'Échoué',
  refunded: 'Remboursé',
};

const ABONNEMENT_LABELS = {
  day_pass:     'Day Pass',
  week_pass:    'Week Pass',
  mensuel:      'Mensuel',
  trimestriel:  'Trimestriel',
  annuel:       'Annuel',
  bureau_prive: 'Bureau Privé',
};

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Email de reçu de paiement (avec PDF en pièce jointe)
// ═══════════════════════════════════════════════════════════════════════════

function buildReceiptEmailHTML(payment, config) {
  const membre      = payment.profiles || {};
  const prenom      = membre.prenom || 'Membre';
  const reservation = payment.reservations || null;
  const abonnement  = payment.abonnements  || null;

  const montant = parseFloat(payment.montant || 0).toFixed(3);
  const statut  = payment.statut || 'pending';
  const numero  = payment.numero_recu || payment.id;

  const datePaiement = payment.date_paiement
    ? new Date(payment.date_paiement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date(payment.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  let serviceDetail = 'Service coworking';
  if (reservation) {
    const nom  = reservation.espaces?.nom || 'Espace';
    const date = new Date(reservation.date_debut).toLocaleDateString('fr-FR');
    const h1   = new Date(reservation.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const h2   = new Date(reservation.date_fin).toLocaleTimeString('fr-FR',   { hour: '2-digit', minute: '2-digit' });
    serviceDetail = `Réservation — ${nom} · ${date} de ${h1} à ${h2}`;
  } else if (abonnement) {
    const d1 = new Date(abonnement.date_debut).toLocaleDateString('fr-FR');
    const d2 = new Date(abonnement.date_fin).toLocaleDateString('fr-FR');
    serviceDetail = `Abonnement ${ABONNEMENT_LABELS[abonnement.type] || abonnement.type} · ${d1} → ${d2}`;
  }

  const statutColor = STATUT_COLORS[statut]  || WARNING;
  const statutLabel = STATUT_LABELS[statut]  || statut;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de paiement ${numero}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- EN-TÊTE -->
        <tr>
          <td style="background:${PRIMARY};padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:${WHITE};font-size:22px;font-weight:700;">${config.coworkingName}</p>
                  <p style="margin:4px 0 0;color:${ACCENT};font-size:12px;">Espace de Coworking</p>
                </td>
                <td align="right">
                  <p style="margin:0;color:${WHITE};font-size:11px;">${config.coworkingEmail}</p>
                  <p style="margin:2px 0 0;color:#C7D2FE;font-size:11px;">${config.coworkingTel}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TITRE + NUMÉRO REÇU -->
        <tr>
          <td style="background:${LIGHT};padding:20px 40px;border-bottom:1px solid #DBEAFE;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Reçu de paiement</p>
                  <p style="margin:4px 0 0;color:${PRIMARY};font-size:20px;font-weight:700;">${numero}</p>
                  <p style="margin:4px 0 0;color:${MUTED};font-size:12px;">Émis le ${datePaiement}</p>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:${statutColor};color:${WHITE};padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;">
                    ${statutLabel}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CORPS BLANC -->
        <tr>
          <td style="background:${WHITE};padding:32px 40px;">

            <!-- Salutation -->
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.6;">
              ${statut === 'paid'
                ? 'Votre paiement a bien été enregistré. Vous trouverez votre reçu officiel en pièce jointe de cet email.'
                : 'Votre paiement est en attente de validation. Vous recevrez une confirmation dès qu\'il sera traité.'
              }
            </p>

            <!-- Détail paiement -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${PRIMARY};padding:12px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Détail du service</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Service</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;padding-bottom:12px;">${serviceDetail}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Mode de paiement</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;padding-bottom:12px;">${MODE_LABELS[payment.mode] || payment.mode}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Référence</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;">${numero}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Total -->
              <tr>
                <td style="background:${LIGHT};padding:16px 20px;border-top:1px solid #E5E7EB;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${PRIMARY};font-size:14px;font-weight:700;">Total TTC</td>
                      <td align="right" style="color:${SECONDARY};font-size:22px;font-weight:800;">${montant} DT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Note pièce jointe -->
            ${statut === 'paid' ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;color:#065F46;font-size:13px;">
                    📎 <strong>Votre reçu PDF officiel</strong> est joint à cet email sous le nom <code style="background:#D1FAE5;padding:2px 6px;border-radius:4px;">${`recu-${numero}.pdf`}</code>
                  </p>
                </td>
              </tr>
            </table>` : ''}

            <!-- CTA Portail -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
                     style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">
                    Accéder à mon portail
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">
              Pour toute question, contactez-nous à 
              <a href="mailto:${config.coworkingEmail}" style="color:${ACCENT};">${config.coworkingEmail}</a>
            </p>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:${PRIMARY};padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#C7D2FE;font-size:11px;">
              ${config.coworkingName} · Propulsé par <strong style="color:${WHITE};">VC LOW</strong> · contact@vclow.tn
            </p>
            <p style="margin:6px 0 0;color:#6B7280;font-size:10px;">
              Cet email est généré automatiquement, merci de ne pas y répondre directement.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — Email de relance impayé
// ═══════════════════════════════════════════════════════════════════════════

function buildReminderEmailHTML(payment, joursRetard, config) {
  const membre  = payment.profiles || {};
  const prenom  = membre.prenom || 'Membre';
  const montant = parseFloat(payment.montant || 0).toFixed(3);
  const numero  = payment.numero_recu || payment.id;

  const urgenceColor  = joursRetard >= 15 ? '#DC2626' : joursRetard >= 7 ? WARNING : '#D97706';
  const urgenceText   = joursRetard >= 15 ? 'URGENT — Dernier rappel' : joursRetard >= 7 ? 'Rappel important' : 'Rappel de paiement';
  const urgenceEmoji  = joursRetard >= 15 ? '🚨' : joursRetard >= 7 ? '⚠️' : '💳';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rappel de paiement — ${numero}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- EN-TÊTE COLORÉ SELON URGENCE -->
        <tr>
          <td style="background:${PRIMARY};padding:28px 40px;">
            <p style="margin:0;color:${WHITE};font-size:20px;font-weight:700;">${config.coworkingName}</p>
            <p style="margin:4px 0 0;color:${ACCENT};font-size:11px;">Espace de Coworking</p>
          </td>
        </tr>

        <!-- BANDEAU URGENCE -->
        <tr>
          <td style="background:${urgenceColor};padding:14px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:14px;font-weight:700;">${urgenceEmoji} ${urgenceText} — Retard de ${joursRetard} jour${joursRetard > 1 ? 's' : ''}</p>
          </td>
        </tr>

        <!-- CORPS -->
        <tr>
          <td style="background:${WHITE};padding:32px 40px;">
            <p style="margin:0 0 20px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              Nous vous contactons car un paiement de votre compte est toujours en attente 
              depuis <strong>${joursRetard} jour${joursRetard > 1 ? 's' : ''}</strong>.
              ${joursRetard >= 15
                ? ' <strong>Sans régularisation dans les prochaines 48h, votre accès pourra être suspendu.</strong>'
                : ' Merci de régulariser votre situation dès que possible.'
              }
            </p>

            <!-- Détail paiement -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${urgenceColor};border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${urgenceColor};padding:10px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;">Paiement en attente</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:10px;">Référence</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;padding-bottom:10px;">${numero}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Mode attendu</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;">${MODE_LABELS[payment.mode] || payment.mode}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background:#FEF2F2;padding:14px 20px;border-top:1px solid #FECACA;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#991B1B;font-size:14px;font-weight:700;">Montant dû</td>
                      <td align="right" style="color:#DC2626;font-size:22px;font-weight:800;">${montant} DT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
                     style="display:inline-block;background:${urgenceColor};color:${WHITE};text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">
                    Régulariser mon paiement
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">
              Une question ? Contactez-nous à 
              <a href="mailto:${config.coworkingEmail}" style="color:${ACCENT};">${config.coworkingEmail}</a>
            </p>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:${PRIMARY};padding:18px 40px;text-align:center;">
            <p style="margin:0;color:#C7D2FE;font-size:11px;">
              ${config.coworkingName} · Propulsé par <strong style="color:${WHITE};">VC LOW</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS D'ENVOI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Envoie un reçu de paiement par email avec PDF en pièce jointe.
 *
 * @param {Object} payment     - Paiement avec jointures (profiles, reservations, abonnements)
 * @param {Buffer} pdfBuffer   - Buffer PDF généré par generateReceiptPDF()
 * @param {Object} config      - { coworkingName, coworkingEmail, coworkingTel, coworkingAdresse }
 */
async function sendReceiptEmail(payment, pdfBuffer, config) {
  const transporter = createTransporter();
  const membre      = payment.profiles || {};
  const toEmail     = membre.email;

  if (!toEmail) {
    console.warn(`⚠️  sendReceiptEmail : pas d'email pour le membre ${payment.user_id}, email non envoyé.`);
    return null;
  }

  const numero    = payment.numero_recu || payment.id;
  const montant   = parseFloat(payment.montant || 0).toFixed(3);
  const isPayee   = payment.statut === 'paid';

  const mailOptions = {
    from:    process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
    to:      toEmail,
    subject: isPayee
      ? `✅ Reçu de paiement ${numero} — ${montant} DT — ${config.coworkingName}`
      : `💳 Paiement enregistré ${numero} — ${config.coworkingName}`,
    html: buildReceiptEmailHTML(payment, config),
    attachments: isPayee && pdfBuffer ? [
      {
        filename:    `recu-${numero}.pdf`,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      },
    ] : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Reçu envoyé à ${toEmail} — MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Erreur envoi email reçu à ${toEmail}:`, err.message);
    throw err;
  }
}

/**
 * Envoie un email de relance pour paiement impayé.
 *
 * @param {Object} payment     - Paiement avec jointures
 * @param {number} joursRetard - Nombre de jours de retard (3, 7 ou 15)
 * @param {Object} config      - Config coworking
 */
async function sendReminderEmail(payment, joursRetard, config) {
  const transporter = createTransporter();
  const membre      = payment.profiles || {};
  const toEmail     = membre.email;

  if (!toEmail) {
    console.warn(`⚠️  sendReminderEmail : pas d'email pour ${payment.user_id}, email non envoyé.`);
    return null;
  }

  const numero  = payment.numero_recu || payment.id;
  const montant = parseFloat(payment.montant || 0).toFixed(3);

  const subjectMap = {
    3:  `💳 Rappel : paiement ${numero} en attente — ${montant} DT`,
    7:  `⚠️ Rappel urgent : paiement ${numero} toujours impayé — ${montant} DT`,
    15: `🚨 URGENT : régularisez votre paiement ${numero} — ${montant} DT`,
  };

  const mailOptions = {
    from:    process.env.EMAIL_FROM || `"${config.coworkingName}" <${config.coworkingEmail}>`,
    to:      toEmail,
    subject: subjectMap[joursRetard] || `Rappel de paiement — ${numero}`,
    html:    buildReminderEmailHTML(payment, joursRetard, config),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Relance J+${joursRetard} envoyée à ${toEmail} — MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Erreur envoi relance J+${joursRetard} à ${toEmail}:`, err.message);
    throw err;
  }
}

/**
 * Vérifie si la config SMTP est bien présente.
 */
function isEmailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = {
  sendReceiptEmail,
  sendReminderEmail,
  isEmailConfigured,
};
