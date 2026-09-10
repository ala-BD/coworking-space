const nodemailer = require('nodemailer');
const { supabaseAdmin } = require('../config/supabase');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

async function requestPasswordReset(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  const genericResponse = {
    message: 'Si cette adresse correspond à un compte, un lien de réinitialisation sera envoyé.'
  };

  try {
    const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo },
    });

    // Do not disclose whether an account exists.
    if (error || !data?.properties?.action_link) return res.json(genericResponse);
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Password reset email impossible: SMTP non configuré.');
      return res.json(genericResponse);
    }

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM || `DeskyWork <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      text: `Cliquez sur ce lien pour choisir un nouveau mot de passe : ${data.properties.action_link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Réinitialisation du mot de passe</h2><p>Vous avez demandé à modifier votre mot de passe.</p><p><a href="${data.properties.action_link}" style="display:inline-block;background:#f95d00;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p><p>Ce lien est valable pour une durée limitée. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p></div>`,
    });
  } catch (error) {
    console.error('Password reset request:', error.message);
  }

  return res.json(genericResponse);
}

module.exports = { requestPasswordReset };
