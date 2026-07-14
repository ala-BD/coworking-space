// backend/utils/generateReceipt.js
// Génération de reçus PDF pour les paiements — Module C Dev 2
// Utilise pdfkit pour créer un PDF professionnel

const PDFDocument = require('pdfkit');

// ── Palette de couleurs (Encre Cobalt — charte VC LOW) ──────────────────────
const COLORS = {
  primary:    '#1B2A6B', // Encre Cobalt foncé
  secondary:  '#2D4CC8', // Cobalt moyen
  accent:     '#4F6EF7', // Cobalt vif
  light:      '#EEF1FF', // Cobalt très clair
  text:       '#1A1A2E', // Texte principal
  muted:      '#6B7280', // Texte secondaire
  border:     '#D1D5DB', // Bordures
  success:    '#059669', // Vert pour "Payé"
  warning:    '#D97706', // Orange pour "En attente"
  white:      '#FFFFFF',
};

// ── Modes de paiement lisibles ───────────────────────────────────────────────
const MODE_LABELS = {
  cash:          'Espèces',
  bank_transfer: 'Virement bancaire',
  check:         'Chèque',
  online:        'Paiement en ligne',
};

// ── Statuts lisibles ─────────────────────────────────────────────────────────
const STATUT_LABELS = {
  pending:  'En attente',
  paid:     'Payé',
  failed:   'Échoué',
  refunded: 'Remboursé',
};

/**
 * Génère un reçu PDF pour un paiement donné.
 *
 * @param {Object} payment  - Objet paiement (depuis Supabase, avec jointures profiles + reservations + abonnements)
 * @param {Object} options
 * @param {string} options.coworkingName  - Nom de l'espace coworking (défaut: "Thirty Three Space")
 * @param {string} options.coworkingEmail - Email de contact (défaut: "contact@33space.tn")
 * @param {string} options.coworkingTel   - Téléphone (défaut: "")
 * @param {string} options.coworkingAdresse - Adresse physique
 * @returns {Promise<Buffer>} - Buffer contenant le PDF généré
 */
function generateReceiptPDF(payment, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const config = {
        coworkingName:    options.coworkingName    || 'Thirty Three Space',
        coworkingEmail:   options.coworkingEmail   || 'contact@33space.tn',
        coworkingTel:     options.coworkingTel     || '+216 XX XXX XXX',
        coworkingAdresse: options.coworkingAdresse || 'Tunis, Tunisie',
      };

      // ── Données membre ──────────────────────────────────────────────────────
      const membre = payment.profiles || {};
      const nomMembre = `${membre.prenom || ''} ${membre.nom || ''}`.trim() || 'Client';
      const emailMembre = membre.email || '—';

      // ── Données réservation / abonnement ────────────────────────────────────
      const reservation = payment.reservations || null;
      const abonnement  = payment.abonnements  || null;

      // ── Dates ───────────────────────────────────────────────────────────────
      const datePaiement = payment.date_paiement
        ? new Date(payment.date_paiement).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
          })
        : new Date(payment.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
          });

      const dateEmission = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      // ── Montant ─────────────────────────────────────────────────────────────
      const montant = parseFloat(payment.montant || 0).toFixed(3);
      const statut  = payment.statut || 'pending';

      // ── Création du document PDF ─────────────────────────────────────────────
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title:    `Reçu ${payment.numero_recu || payment.id}`,
          Author:   config.coworkingName,
          Subject:  'Reçu de paiement',
          Keywords: 'reçu paiement coworking',
        },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth  = doc.page.width;
      const pageHeight = doc.page.height;
      const margin     = 50;
      const contentW   = pageWidth - margin * 2;

      // ════════════════════════════════════════════════════════════════════════
      // EN-TÊTE — Bandeau coloré
      // ════════════════════════════════════════════════════════════════════════
      doc.rect(0, 0, pageWidth, 120).fill(COLORS.primary);

      // Nom du coworking
      doc.fillColor(COLORS.white)
         .font('Helvetica-Bold')
         .fontSize(22)
         .text(config.coworkingName, margin, 30, { width: contentW * 0.6 });

      // Sous-titre
      doc.fillColor(COLORS.accent)
         .font('Helvetica')
         .fontSize(10)
         .text('Espace de Coworking', margin, 58);

      // Contact (côté droit)
      doc.fillColor(COLORS.white)
         .font('Helvetica')
         .fontSize(9)
         .text(config.coworkingEmail, margin + contentW * 0.6, 32, {
           width: contentW * 0.4, align: 'right',
         })
         .text(config.coworkingTel, margin + contentW * 0.6, 46, {
           width: contentW * 0.4, align: 'right',
         })
         .text(config.coworkingAdresse, margin + contentW * 0.6, 60, {
           width: contentW * 0.4, align: 'right',
         });

      // Titre REÇU DE PAIEMENT
      doc.fillColor(COLORS.light)
         .font('Helvetica-Bold')
         .fontSize(13)
         .text('REÇU DE PAIEMENT', margin, 90, { width: contentW });

      // ════════════════════════════════════════════════════════════════════════
      // NUMÉRO DE REÇU + STATUT
      // ════════════════════════════════════════════════════════════════════════
      const yAfterHeader = 140;

      // Fond léger
      doc.rect(margin, yAfterHeader, contentW, 55)
         .fill(COLORS.light);

      doc.fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .fontSize(16)
         .text(payment.numero_recu || `PAY-${payment.id.slice(0, 8).toUpperCase()}`, margin + 15, yAfterHeader + 10);

      doc.fillColor(COLORS.muted)
         .font('Helvetica')
         .fontSize(9)
         .text(`Émis le : ${dateEmission}`, margin + 15, yAfterHeader + 32);

      // Badge statut (côté droit)
      const statutColor = statut === 'paid' ? COLORS.success : COLORS.warning;
      const statutLabel = STATUT_LABELS[statut] || statut;
      const badgeX      = margin + contentW - 120;
      const badgeY      = yAfterHeader + 15;

      doc.rect(badgeX, badgeY, 110, 24)
         .fill(statutColor);
      doc.fillColor(COLORS.white)
         .font('Helvetica-Bold')
         .fontSize(10)
         .text(statutLabel.toUpperCase(), badgeX, badgeY + 7, { width: 110, align: 'center' });

      // ════════════════════════════════════════════════════════════════════════
      // SECTION : INFORMATIONS CLIENT
      // ════════════════════════════════════════════════════════════════════════
      const yClient = yAfterHeader + 75;

      doc.fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .fontSize(11)
         .text('INFORMATIONS CLIENT', margin, yClient);

      // Ligne séparatrice
      doc.moveTo(margin, yClient + 16)
         .lineTo(margin + contentW, yClient + 16)
         .strokeColor(COLORS.secondary)
         .lineWidth(1.5)
         .stroke();

      const col1X = margin;
      const col2X = margin + contentW / 2;
      const yData = yClient + 26;

      // Colonne gauche
      _field(doc, 'Nom & Prénom', nomMembre,      col1X, yData);
      _field(doc, 'Email',        emailMembre,    col1X, yData + 36);
      _field(doc, 'Date paiement', datePaiement,  col1X, yData + 72);

      // Colonne droite
      _field(doc, 'Mode de paiement', MODE_LABELS[payment.mode] || payment.mode, col2X, yData);
      if (payment.reference_externe) {
        _field(doc, 'Référence', payment.reference_externe, col2X, yData + 36);
      }

      // ════════════════════════════════════════════════════════════════════════
      // SECTION : DÉTAIL DU SERVICE
      // ════════════════════════════════════════════════════════════════════════
      const yDetail = yData + 120;

      doc.fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .fontSize(11)
         .text('DÉTAIL DU SERVICE', margin, yDetail);

      doc.moveTo(margin, yDetail + 16)
         .lineTo(margin + contentW, yDetail + 16)
         .strokeColor(COLORS.secondary)
         .lineWidth(1.5)
         .stroke();

      // En-têtes tableau
      const tableY     = yDetail + 26;
      const col_desc   = margin;
      const col_detail = margin + contentW * 0.5;
      const col_prix   = margin + contentW * 0.82;

      doc.rect(col_desc, tableY, contentW, 22).fill(COLORS.primary);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9);
      doc.text('DESCRIPTION',   col_desc   + 8, tableY + 7, { width: contentW * 0.48 });
      doc.text('DÉTAIL',        col_detail + 8, tableY + 7, { width: contentW * 0.3  });
      doc.text('MONTANT (DT)',  col_prix,        tableY + 7, { width: contentW * 0.18, align: 'right' });

      // Ligne de données
      const rowY = tableY + 30;
      doc.rect(col_desc, rowY, contentW, 28).fill(COLORS.light);

      let description = 'Service coworking';
      let detail      = '—';

      if (reservation) {
        description = `Réservation — ${reservation.espaces?.nom || 'Espace'}`;
        const d1 = new Date(reservation.date_debut).toLocaleDateString('fr-FR');
        const h1 = new Date(reservation.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const h2 = new Date(reservation.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        detail = `${d1} · ${h1}→${h2}`;
      } else if (abonnement) {
        const LABELS = { day_pass: 'Day Pass', week_pass: 'Week Pass', mensuel: 'Mensuel', trimestriel: 'Trimestriel', annuel: 'Annuel', bureau_prive: 'Bureau Privé' };
        description = `Abonnement — ${LABELS[abonnement.type] || abonnement.type}`;
        const d1 = new Date(abonnement.date_debut).toLocaleDateString('fr-FR');
        const d2 = new Date(abonnement.date_fin).toLocaleDateString('fr-FR');
        detail = `${d1} → ${d2}`;
      }

      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);
      doc.text(description, col_desc   + 8, rowY + 9, { width: contentW * 0.48 });
      doc.text(detail,      col_detail + 8, rowY + 9, { width: contentW * 0.3  });
      doc.font('Helvetica-Bold')
         .text(`${montant} DT`, col_prix, rowY + 9, { width: contentW * 0.18, align: 'right' });

      // ════════════════════════════════════════════════════════════════════════
      // TOTAL
      // ════════════════════════════════════════════════════════════════════════
      const totalY = rowY + 45;

      doc.rect(col_prix - 60, totalY, 60 + contentW * 0.18, 32).fill(COLORS.primary);
      doc.fillColor(COLORS.white)
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('TOTAL TTC', col_prix - 58, totalY + 11, { width: 56, align: 'left' });
      doc.fillColor(COLORS.accent)
         .font('Helvetica-Bold')
         .fontSize(13)
         .text(`${montant} DT`, col_prix, totalY + 9, { width: contentW * 0.18, align: 'right' });

      // ════════════════════════════════════════════════════════════════════════
      // MESSAGE DE BAS DE PAGE
      // ════════════════════════════════════════════════════════════════════════
      const yNote = totalY + 60;

      doc.rect(margin, yNote, contentW, 50).fill(COLORS.light);
      doc.fillColor(COLORS.muted)
         .font('Helvetica')
         .fontSize(8)
         .text(
           'Ce reçu est généré automatiquement par le système VC LOW. Conservez ce document comme justificatif de paiement. ' +
           'Pour toute réclamation, contactez-nous à ' + config.coworkingEmail,
           margin + 10, yNote + 10,
           { width: contentW - 20, align: 'center' }
         );

      // ════════════════════════════════════════════════════════════════════════
      // PIED DE PAGE
      // ════════════════════════════════════════════════════════════════════════
      doc.rect(0, pageHeight - 40, pageWidth, 40).fill(COLORS.primary);
      doc.fillColor(COLORS.light)
         .font('Helvetica')
         .fontSize(8)
         .text(
           `${config.coworkingName}  ·  Propulsé par VC LOW  ·  contact@vclow.tn`,
           margin,
           pageHeight - 26,
           { width: contentW, align: 'center' }
         );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

// ── Helper : affichage d'un champ label / valeur ────────────────────────────
function _field(doc, label, value, x, y) {
  doc.fillColor(COLORS.muted)
     .font('Helvetica')
     .fontSize(8)
     .text(label, x, y);
  doc.fillColor(COLORS.text)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(value || '—', x, y + 11, { width: 220 });
}

module.exports = { generateReceiptPDF };
