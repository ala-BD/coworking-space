// routes/otp.routes.js
// Génération et vérification du code OTP pour l'inscription
'use strict';

const express    = require('express');
const nodemailer = require('nodemailer');
const router     = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// ── Transporter SMTP (réutilise la config existante) ─────────────────────────
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
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: pass,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ── Template email OTP optimisé Inbox Principale ─────────────────────────────
function buildOtpEmailHTML(code, prenom) {
  const digits = code.split('');
  const coworkingName = process.env.COWORKING_NAME || 'DeskyWork';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de confirmation - ${coworkingName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          
          <!-- En-tête de marque -->
          <tr>
            <td style="background-color: #100f0d; padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                ${coworkingName}
              </h1>
              <p style="margin: 6px 0 0; color: #f95d00; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                Vérification de sécurité
              </p>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <p style="margin: 0 0 12px; color: #1e293b; font-size: 18px; font-weight: 700;">
                Bonjour ${prenom || ''},
              </p>
              <p style="margin: 0 0 28px; color: #475569; font-size: 14px; line-height: 1.6;">
                Merci de vous inscrire sur <strong>${coworkingName}</strong>. Veuillez utiliser le code de sécurité ci-dessous pour confirmer votre adresse email :
              </p>

              <!-- Bloc Code à 6 chiffres -->
              <div style="background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    ${digits.map(d => `
                    <td style="padding: 0 5px;">
                      <div style="width: 48px; height: 58px; line-height: 58px; background-color: #ffffff; border: 2px solid #f95d00; border-radius: 10px; font-size: 26px; font-weight: 800; color: #100f0d; text-align: center;">
                        ${d}
                      </div>
                    </td>`).join('')}
                  </tr>
                </table>
              </div>

              <!-- Information de validité -->
              <p style="margin: 0 0 24px; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                ⏳ Ce code est strictement personnel et expire dans <strong>10 minutes</strong>.
              </p>

              <hr style="border: none; border-top: 1px solid #edf2f7; margin: 24px 0;" />

              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #edf2f7; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${new Date().getFullYear()} ${coworkingName} · Message automatique sécurisé
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── POST /api/otp/send ────────────────────────────────────────────────────────
// Génère un code OTP 6 chiffres, l'enregistre en DB, l'envoie par email
router.post('/otp/send', async (req, res) => {
  let { email, prenom } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requis.' });
  }

  // Nettoyage et normalisation de l'email
  email = email.trim().toLowerCase();

  // Correction courante de faute de frappe (@gmial -> @gmail, @gmai -> @gmail, etc.)
  if (email.includes('@gmial.')) {
    email = email.replace('@gmial.', '@gmail.');
  }

  try {
    // Générer un code 6 chiffres aléatoire
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalider les anciens codes pour cet email
    await supabaseAdmin
      .from('email_otp')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Enregistrer le nouveau code
    const { error: insertError } = await supabaseAdmin
      .from('email_otp')
      .insert({ email, code, expires_at: expiresAt });

    if (insertError) throw insertError;

    // Envoyer l'email (si SMTP configuré)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = createTransporter();
        const coworkingName = process.env.COWORKING_NAME || 'DeskyWork';
        
        const plainTextBody = `Bonjour ${prenom || ''},\n\nVotre code de confirmation pour votre compte ${coworkingName} est : ${code}\n\nCe code est valable pendant 10 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe ${coworkingName}`;

        await transporter.sendMail({
          from:    `"${coworkingName}" <${process.env.SMTP_USER}>`,
          to:      email,
          replyTo: process.env.SMTP_USER,
          subject: `${coworkingName} - Code de confirmation : ${code}`,
          text:    plainTextBody,
          html:    buildOtpEmailHTML(code, prenom || ''),
          headers: {
            'X-Entity-Ref-Type': 'transactional',
            'Auto-Submitted': 'auto-generated',
            'X-Priority': '1',
            'Importance': 'high',
          },
        });
        console.log(`✉️  OTP ${code} envoyé à ${email}`);
      } catch (mailErr) {
        console.error(`⚠️ Erreur d'envoi SMTP à ${email}:`, mailErr.message);
      }
    }

    console.log(`\n========================================\n🔐 CODE OTP envoyé à ${email} : ${code}\n========================================\n`);

    res.json({
      success: true,
      message: 'Code envoyé par email.',
      email,
    });
  } catch (err) {
    console.error('❌ Erreur OTP send:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code.' });
  }
});

// ── POST /api/otp/verify ─────────────────────────────────────────────────────
// Vérifie que le code saisi correspond au code en DB
router.post('/otp/verify', async (req, res) => {
  let { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email et code requis.' });
  }

  email = email.trim().toLowerCase();
  if (email.includes('@gmial.')) {
    email = email.replace('@gmial.', '@gmail.');
  }

  code = String(code).trim();

  try {
    // Chercher le code valide le plus récent
    const { data, error } = await supabaseAdmin
      .from('email_otp')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    // Marquer le code comme utilisé
    await supabaseAdmin
      .from('email_otp')
      .update({ used: true })
      .eq('id', data.id);

    res.json({ success: true, message: 'Code vérifié avec succès.' });
  } catch (err) {
    console.error('❌ Erreur OTP verify:', err.message);
    res.status(500).json({ error: 'Erreur lors de la vérification.' });
  }
});

// ── POST /api/otp/auto-confirm ────────────────────────────────────────────────
// Auto-confirme l'email dans Supabase Auth après vérification OTP et signUp
// Règle d'approbation :
// - Rôle 'admin' (Admin Coworking) -> statut_compte = 'en_attente' (nécessite validation Super Admin)
// - Tous les autres rôles ('member', 'formateur', etc.) -> statut_compte = 'actif' (création directe sans approbation)
router.post('/otp/auto-confirm', async (req, res) => {
  const { userId, email, role } = req.body;
  if (!userId && !email) {
    return res.status(400).json({ error: 'userId ou email requis.' });
  }

  try {
    let idToConfirm = userId;
    if (!idToConfirm && email) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      const u = data?.users?.find(x => x.email === email);
      if (u) idToConfirm = u.id;
    }

    if (idToConfirm) {
      await supabaseAdmin.auth.admin.updateUserById(idToConfirm, { email_confirm: true });
      console.log(`✅ Email ${email || idToConfirm} auto-confirmé dans Supabase Auth.`);

      // Récupérer le profil actuel pour connaître le rôle réel
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, role, statut_compte, nom, prenom')
        .eq('id', idToConfirm)
        .single();

      const userRole = role || profile?.role || 'member';
      const targetStatus = userRole === 'admin' ? 'en_attente' : 'actif';

      // Mettre à jour le statut du compte selon la règle métier
      await supabaseAdmin
        .from('profiles')
        .update({
          statut_compte: targetStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', idToConfirm);

      console.log(`✅ Compte ${idToConfirm} (${userRole}) configuré avec statut_compte = "${targetStatus}"`);

      // Si c'est un compte admin en attente, notifier les super admins
      if (userRole === 'admin') {
        try {
          const { data: superAdmins } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'super_admin');

          if (superAdmins && superAdmins.length > 0) {
            const userName = profile ? `${profile.prenom} ${profile.nom}` : (email || 'Nouvel admin');
            for (const sa of superAdmins) {
              await supabaseAdmin.from('notifications').insert({
                user_id: sa.id,
                type: 'nouveau_coworking_en_attente',
                canal: 'Dashboard',
                message: `🏢 Nouvelle demande de compte Admin Coworking : ${userName} (${email || ''}) — En attente de validation.`,
              });
            }
          }
        } catch (notifErr) {
          console.warn('⚠️ Erreur notification super admin nouveau coworking:', notifErr.message);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erreur auto-confirm:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

