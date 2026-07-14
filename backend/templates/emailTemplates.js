// backend/templates/emailTemplates.js
// Module F Dev 2 — Étape F1 — S3
// Templates d'emails pour les 15 notifications automatiques
// Style : Encre & Cobalt — Responsive HTML

// ── Palette couleurs (Encre Cobalt) ──────────────────────────────────────────
const PRIMARY   = '#1B2A6B';
const SECONDARY = '#2D4CC8';
const ACCENT    = '#4F6EF7';
const LIGHT     = '#EEF1FF';
const MUTED     = '#6B7280';
const SUCCESS   = '#059669';
const WARNING   = '#D97706';
const DANGER    = '#DC2626';
const WHITE     = '#FFFFFF';

// ── Helper : génère l'en-tête commun ──────────────────────────────────────────
function buildHeader(config) {
  return `
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
    </tr>`;
}

// ── Helper : génère le pied de page commun ───────────────────────────────────
function buildFooter(config) {
  return `
    <tr>
      <td style="background:${PRIMARY};padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#C7D2FE;font-size:11px;">
          ${config.coworkingName} · Propulsé par <strong style="color:${WHITE};">VC LOW</strong> · contact@vclow.tn
        </p>
        <p style="margin:6px 0 0;color:#6B7280;font-size:10px;">
          Cet email est généré automatiquement, merci de ne pas y répondre directement.
        </p>
      </td>
    </tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Nouvelle inscription membre
// ══════════════════════════════════════════════════════════════════════════════

function templateNouveauMembre(membre, config) {
  const prenom = membre.prenom || 'Membre';
  const nom = membre.nom || '';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Bienvenue ${prenom}</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${SUCCESS};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">✨ Bienvenue dans notre communauté !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:18px;font-weight:700;">
              Bonjour ${prenom} ${nom},
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
              Nous sommes ravis de vous accueillir chez <strong>${config.coworkingName}</strong> ! 
              Votre compte a été créé avec succès.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Vous pouvez dès maintenant accéder à votre portail membre pour :
            </p>
            <ul style="margin:0 0 28px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
              <li>Réserver un espace de travail</li>
              <li>Consulter vos factures et historique</li>
              <li>Voir les formations disponibles</li>
              <li>Gérer votre abonnement</li>
            </ul>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Accéder à mon portail
                </a>
              </td></tr>
            </table>
            <p style="margin:0;color:${MUTED};font-size:12px;">
              Questions ? Contactez-nous à <a href="mailto:${config.coworkingEmail}" style="color:${ACCENT};">${config.coworkingEmail}</a>
            </p>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — Confirmation de réservation
// ══════════════════════════════════════════════════════════════════════════════

function templateConfirmationReservation(reservation, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = reservation.espaces?.nom || 'Espace';
  const dateDebut = new Date(reservation.date_debut);
  const dateFin = new Date(reservation.date_fin);
  const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const heureFin = dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Confirmation de réservation</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${SUCCESS};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">✅ Réservation confirmée</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre réservation a été confirmée avec succès. Voici les détails :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${PRIMARY};padding:12px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;text-transform:uppercase;">Détails de votre réservation</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Espace</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${espace}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Date</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${dateStr}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Horaires</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;">${heureDebut} → ${heureFin}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir mes réservations
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — Rappel réservation J-1
// ══════════════════════════════════════════════════════════════════════════════

function templateRappelReservationJ1(reservation, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = reservation.espaces?.nom || 'Espace';
  const dateDebut = new Date(reservation.date_debut);
  const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rappel de réservation</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${ACCENT};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">📅 Rappel : Votre réservation est demain !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Petit rappel : votre réservation est programmée pour <strong>demain</strong> !
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border:1px solid #DBEAFE;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr>
                <td>
                  <p style="margin:0 0 12px;color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Votre réservation</p>
                  <p style="margin:0 0 8px;color:${PRIMARY};font-size:18px;font-weight:700;">${espace}</p>
                  <p style="margin:0 0 4px;color:#374151;font-size:14px;">📆 ${dateStr}</p>
                  <p style="margin:0;color:#374151;font-size:14px;">🕐 ${heureDebut}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;color:#374151;font-size:13px;line-height:1.6;">
              💡 <strong>Astuce :</strong> Pensez à arriver quelques minutes en avance pour un check-in sans stress !
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir ma réservation
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — Session : 15 min avant la fin
// ══════════════════════════════════════════════════════════════════════════════

function templateAlerte15MinAvantFin(session, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = session.reservations?.espaces?.nom || 'Espace';
  const heureFin = new Date(session.reservations?.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre session se termine bientôt</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${WARNING};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">⏰ Plus que 15 minutes !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre session dans <strong>${espace}</strong> se termine dans <strong style="color:${WARNING};">15 minutes</strong> (heure de fin : ${heureFin}).
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:2px solid #FBBF24;border-radius:12px;padding:18px;margin-bottom:24px;">
              <tr><td align="center">
                <p style="margin:0 0 8px;color:#92400E;font-size:14px;font-weight:700;">💡 Vous avez besoin de plus de temps ?</p>
                <p style="margin:0;color:#78350F;font-size:13px;">
                  Prolongez votre session directement depuis votre portail (si l'espace est disponible).
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                   style="display:inline-block;background:${WARNING};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Prolonger ma session
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 5 — Session : fin du temps réservé
// ══════════════════════════════════════════════════════════════════════════════

function templateFinSession(session, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = session.reservations?.espaces?.nom || 'Espace';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre session est terminée</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${DANGER};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">⏱️ Temps écoulé !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
              Votre temps de réservation dans <strong>${espace}</strong> est maintenant écoulé.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Merci de libérer l'espace pour les prochains utilisateurs.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:18px;margin-bottom:24px;">
              <tr><td align="center">
                <p style="margin:0;color:#7F1D1D;font-size:13px;">
                  💳 Si vous souhaitez prolonger votre session, des frais supplémentaires s'appliqueront automatiquement.
                </p>
              </td></tr>
            </table>
            <p style="margin:0;color:${MUTED};font-size:13px;text-align:center;">
              Merci d'avoir choisi ${config.coworkingName} ! À bientôt 👋
            </p>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 6 — Dépassement de session détecté
// ══════════════════════════════════════════════════════════════════════════════

function templateDepassementSession(session, membre, minutesDepassement, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = session.reservations?.espaces?.nom || 'Espace';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Dépassement de session</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${DANGER};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">🚨 Dépassement de ${minutesDepassement} minute${minutesDepassement > 1 ? 's' : ''}</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Nous avons constaté que vous êtes toujours dans <strong>${espace}</strong> alors que votre créneau est terminé depuis <strong style="color:${DANGER};">${minutesDepassement} minute${minutesDepassement > 1 ? 's' : ''}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:2px solid #DC2626;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr><td>
                <p style="margin:0 0 12px;color:#7F1D1D;font-size:14px;font-weight:700;">⚠️ Facturation supplémentaire</p>
                <p style="margin:0;color:#991B1B;font-size:13px;line-height:1.6;">
                  Des frais d'extension seront appliqués automatiquement sur votre prochaine facture conformément à notre politique tarifaire.
                </p>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;color:#374151;font-size:13px;line-height:1.6;">
              Merci de libérer l'espace dès que possible pour éviter tout désagrément avec les réservations suivantes.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                   style="display:inline-block;background:${DANGER};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir ma facture
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 7 — Abonnement expirant (J-7)
// ══════════════════════════════════════════════════════════════════════════════

function templateAbonnementExpirantJ7(abonnement, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const typeAbonnement = {
    day_pass: 'Day Pass',
    week_pass: 'Week Pass',
    mensuel: 'Mensuel',
    trimestriel: 'Trimestriel',
    annuel: 'Annuel',
    bureau_prive: 'Bureau Privé'
  }[abonnement.type] || abonnement.type;
  
  const dateFin = new Date(abonnement.date_fin).toLocaleDateString('fr-FR', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre abonnement expire bientôt</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${WARNING};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">📆 Votre abonnement expire dans 7 jours</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre abonnement <strong>${typeAbonnement}</strong> arrivera à expiration le <strong>${dateFin}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr><td>
                <p style="margin:0 0 12px;color:#78350F;font-size:14px;font-weight:700;">💡 Renouvelez dès maintenant</p>
                <p style="margin:0;color:#92400E;font-size:13px;line-height:1.6;">
                  Pour continuer à profiter de votre espace sans interruption, pensez à renouveler votre abonnement avant la date d'expiration.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/abonnement" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Renouveler mon abonnement
                </a>
              </td></tr>
            </table>
            <p style="margin:0;color:${MUTED};font-size:12px;text-align:center;">
              Questions ? Contactez-nous à <a href="mailto:${config.coworkingEmail}" style="color:${ACCENT};">${config.coworkingEmail}</a>
            </p>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 8 — Abonnement expiré
// ══════════════════════════════════════════════════════════════════════════════

function templateAbonnementExpire(abonnement, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const typeAbonnement = {
    day_pass: 'Day Pass',
    week_pass: 'Week Pass',
    mensuel: 'Mensuel',
    trimestriel: 'Trimestriel',
    annuel: 'Annuel',
    bureau_prive: 'Bureau Privé'
  }[abonnement.type] || abonnement.type;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre abonnement a expiré</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${DANGER};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">⚠️ Votre abonnement a expiré</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre abonnement <strong>${typeAbonnement}</strong> a expiré. Vous n'avez plus accès aux espaces de coworking.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:2px solid #DC2626;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr><td>
                <p style="margin:0 0 12px;color:#7F1D1D;font-size:14px;font-weight:700;">🚫 Accès suspendu</p>
                <p style="margin:0;color:#991B1B;font-size:13px;line-height:1.6;">
                  Pour retrouver l'accès à votre espace de travail, veuillez souscrire un nouvel abonnement.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/abonnement" 
                   style="display:inline-block;background:${DANGER};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Renouveler maintenant
                </a>
              </td></tr>
            </table>
            <p style="margin:0;color:${MUTED};font-size:12px;text-align:center;">
              Besoin d'aide ? <a href="mailto:${config.coworkingEmail}" style="color:${ACCENT};">${config.coworkingEmail}</a>
            </p>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 9 — Paiement enregistré (déjà existant dans sendEmail.js, on le garde pour cohérence)
// ══════════════════════════════════════════════════════════════════════════════
// Note : Ce template existe déjà dans utils/sendEmail.js (buildReceiptEmailHTML)
// On peut soit le réutiliser, soit créer une version simplifiée ici

function templatePaiementEnregistre(payment, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const montant = parseFloat(payment.montant || 0).toFixed(3);
  const numero = payment.numero_recu || payment.id;
  const statut = payment.statut === 'paid' ? '✅ Payé' : '⏳ En attente';
  const statutColor = payment.statut === 'paid' ? SUCCESS : WARNING;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Paiement enregistré</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${statutColor};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">${statut} — Reçu ${numero}</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              ${payment.statut === 'paid' 
                ? 'Votre paiement a bien été enregistré. Vous trouverez votre reçu en pièce jointe.' 
                : 'Votre paiement est en attente de validation. Vous recevrez une confirmation dès qu\'il sera traité.'}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${PRIMARY};padding:12px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;">DÉTAIL DU PAIEMENT</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Référence</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${numero}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Montant TTC</td>
                      <td align="right" style="color:${SECONDARY};font-size:18px;font-weight:700;">${montant} DT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/factures" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir mes factures
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 10 — Paiement en retard J+3 (déjà existant dans sendEmail.js, version simplifiée)
// ══════════════════════════════════════════════════════════════════════════════
// Note : Ce template existe dans utils/sendEmail.js (buildReminderEmailHTML)

function templatePaiementRetardJ3(payment, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const montant = parseFloat(payment.montant || 0).toFixed(3);
  const numero = payment.numero_recu || payment.id;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rappel de paiement</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:#D97706;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">💳 Rappel de paiement — Retard de 3 jours</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Nous vous contactons car un paiement de votre compte est toujours en attente depuis <strong>3 jours</strong>. Merci de régulariser votre situation dès que possible.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #D97706;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:#D97706;padding:10px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;">PAIEMENT EN ATTENTE</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Référence</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;">${numero}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background:#FEF2F2;padding:14px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#991B1B;font-size:14px;font-weight:700;">Montant dû</td>
                      <td align="right" style="color:#DC2626;font-size:20px;font-weight:800;">${montant} DT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/factures" 
                   style="display:inline-block;background:#D97706;color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Régulariser mon paiement
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 11 — Paiement en retard J+7
// ══════════════════════════════════════════════════════════════════════════════

function templatePaiementRetardJ7(payment, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const montant = parseFloat(payment.montant || 0).toFixed(3);
  const numero = payment.numero_recu || payment.id;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rappel urgent de paiement</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${WARNING};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">⚠️ RAPPEL URGENT — Retard de 7 jours</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Malgré notre premier rappel, votre paiement est toujours en attente depuis <strong>7 jours</strong>. <strong>Merci de régulariser rapidement</strong> pour éviter toute suspension de votre compte.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${WARNING};border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${WARNING};padding:12px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;">⚠️ PAIEMENT IMPAYÉ DEPUIS 7 JOURS</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Référence</td>
                      <td align="right" style="color:#111827;font-size:13px;font-weight:600;">${numero}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background:#FEF2F2;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#991B1B;font-size:14px;font-weight:700;">Montant dû</td>
                      <td align="right" style="color:#DC2626;font-size:22px;font-weight:800;">${montant} DT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:16px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0;color:#78350F;font-size:13px;line-height:1.6;">
                  ⚠️ <strong>Sans régularisation sous 8 jours</strong>, votre accès aux espaces sera suspendu automatiquement.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/factures" 
                   style="display:inline-block;background:${WARNING};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Régulariser MAINTENANT
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 12 — Annulation de réservation
// ══════════════════════════════════════════════════════════════════════════════

function templateAnnulationReservation(reservation, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const espace = reservation.espaces?.nom || 'Espace';
  const dateDebut = new Date(reservation.date_debut);
  const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Annulation de réservation</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:#7C3AED;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">🗑️ Réservation annulée</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre réservation a été annulée avec succès. Voici les détails :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:#F3F4F6;padding:12px 20px;">
                  <p style="margin:0;color:#374151;font-size:12px;font-weight:700;">RÉSERVATION ANNULÉE</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Espace</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${espace}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Date</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${dateStr}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Heure</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;">${heureDebut}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0;color:#065F46;font-size:13px;">
                  💡 Selon notre politique d'annulation, le remboursement éventuel sera traité sous 3 à 5 jours ouvrés.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/reservations" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Faire une nouvelle réservation
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 13 — Inscription à une formation
// ══════════════════════════════════════════════════════════════════════════════

function templateInscriptionFormation(formation, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const titre = formation.titre || 'Formation';
  const dateDebut = new Date(formation.date);
  const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formateur = formation.formateurs?.nom || 'Formateur';
  const salle = formation.espaces?.nom || 'Salle à définir';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Inscription confirmée</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${SUCCESS};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">🎓 Inscription confirmée !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Votre inscription à la formation <strong>${titre}</strong> a bien été enregistrée !
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${PRIMARY};padding:12px 20px;">
                  <p style="margin:0;color:${WHITE};font-size:12px;font-weight:700;">DÉTAILS DE LA FORMATION</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Formation</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${titre}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Formateur</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${formateur}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Date</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${dateStr}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;padding-bottom:12px;">Horaire</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-bottom:12px;">${heureDebut}</td>
                    </tr>
                    <tr>
                      <td style="color:${MUTED};font-size:12px;">Lieu</td>
                      <td align="right" style="color:#111827;font-size:14px;font-weight:600;">${salle}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border:1px solid #DBEAFE;border-radius:10px;padding:16px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0;color:#1E40AF;font-size:13px;">
                  📌 <strong>Rappel :</strong> Vous recevrez un rappel la veille de la formation.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/formations" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir mes formations
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 14 — Rappel formation J-1
// ══════════════════════════════════════════════════════════════════════════════

function templateRappelFormationJ1(formation, membre, config) {
  const prenom = membre.prenom || 'Membre';
  const titre = formation.titre || 'Formation';
  const dateDebut = new Date(formation.date);
  const dateStr = dateDebut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formateur = formation.formateurs?.nom || 'Formateur';
  const salle = formation.espaces?.nom || 'Salle à définir';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rappel de formation</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${ACCENT};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">🎓 Rappel : Votre formation est demain !</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              Bonjour <strong>${prenom}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Petit rappel : la formation <strong>${titre}</strong> à laquelle vous êtes inscrit(e) aura lieu <strong>demain</strong> !
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border:1px solid #DBEAFE;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr>
                <td>
                  <p style="margin:0 0 12px;color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Votre formation</p>
                  <p style="margin:0 0 12px;color:${PRIMARY};font-size:18px;font-weight:700;">${titre}</p>
                  <p style="margin:0 0 6px;color:#374151;font-size:14px;">👤 Formateur : ${formateur}</p>
                  <p style="margin:0 0 6px;color:#374151;font-size:14px;">📆 ${dateStr}</p>
                  <p style="margin:0 0 6px;color:#374151;font-size:14px;">🕐 ${heureDebut}</p>
                  <p style="margin:0;color:#374151;font-size:14px;">📍 ${salle}</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FCD34D;border-radius:10px;padding:16px;margin-bottom:24px;">
              <tr><td>
                <p style="margin:0;color:#78350F;font-size:13px;">
                  💡 <strong>Conseil :</strong> Prévoyez d'arriver 10 minutes en avance et apportez de quoi prendre des notes !
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/formations" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Voir ma formation
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 15 — Nouveau message portail
// ══════════════════════════════════════════════════════════════════════════════

function templateNouveauMessagePortail(message, expediteur, config) {
  const prenomExpediteur = expediteur?.prenom || 'Un membre';
  const nomExpediteur = expediteur?.nom || '';
  const contenuMessage = message.contenu || 'Nouveau message';
  const sujet = message.sujet || 'Message';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Nouveau message</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        ${buildHeader(config)}
        <tr>
          <td style="background:${ACCENT};padding:16px 40px;text-align:center;">
            <p style="margin:0;color:${WHITE};font-size:16px;font-weight:700;">💬 Nouveau message portail</p>
          </td>
        </tr>
        <tr>
          <td style="background:${WHITE};padding:40px;">
            <p style="margin:0 0 24px;color:${PRIMARY};font-size:16px;">
              <strong>Bonjour,</strong>
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">
              Vous avez reçu un nouveau message de <strong>${prenomExpediteur} ${nomExpediteur}</strong> via le portail membre.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="background:${LIGHT};padding:12px 20px;border-bottom:1px solid #DBEAFE;">
                  <p style="margin:0;color:${PRIMARY};font-size:14px;font-weight:700;">Sujet : ${sujet}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 20px;background:#FAFAFA;">
                  <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${contenuMessage}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
                  <p style="margin:0;color:${MUTED};font-size:12px;">
                    Envoyé le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} 
                    à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/messages" 
                   style="display:inline-block;background:${SECONDARY};color:${WHITE};text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                  Répondre au message
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        ${buildFooter(config)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS — Toutes les fonctions de templates
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Helpers
  buildHeader,
  buildFooter,
  
  // Templates (15 notifications du Tableau F)
  templateNouveauMembre,                  // 1. Nouvelle inscription membre
  templateConfirmationReservation,        // 2. Confirmation réservation
  templateRappelReservationJ1,            // 3. Rappel réservation J-1
  templateAlerte15MinAvantFin,            // 4. Session : 15 min avant la fin
  templateFinSession,                     // 5. Session : fin du temps réservé
  templateDepassementSession,             // 6. Dépassement de session détecté
  templateAbonnementExpirantJ7,           // 7. Abonnement expirant (J-7)
  templateAbonnementExpire,               // 8. Abonnement expiré
  templatePaiementEnregistre,             // 9. Paiement enregistré
  templatePaiementRetardJ3,               // 10. Paiement en retard J+3
  templatePaiementRetardJ7,               // 11. Paiement en retard J+7
  templateAnnulationReservation,          // 12. Annulation de réservation
  templateInscriptionFormation,           // 13. Inscription à une formation
  templateRappelFormationJ1,              // 14. Rappel formation J-1
  templateNouveauMessagePortail,          // 15. Nouveau message portail
};
