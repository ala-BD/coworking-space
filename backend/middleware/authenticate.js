// middleware/authenticate.js — Authentification JWT + chargement profil
const { supabaseAdmin, getUserClient } = require('../config/supabase');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token JWT requis (Authorization: Bearer <token>).' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Token JWT invalide ou expiré.' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profil membre introuvable.' });
  }

  if (profile.statut_compte && profile.statut_compte !== 'actif') {
    if (profile.statut_compte === 'en_attente') {
      return res.status(403).json({
        error: "Compte en attente d'approbation. L'administrateur doit valider votre inscription.",
        code: 'PENDING_APPROVAL',
      });
    }
    return res.status(403).json({ error: "Compte suspendu ou expiré. Contactez l'administrateur." });
  }

  req.user = data.user;
  req.profile = profile;
  req.token = token;
  req.db = getUserClient(token);
  req.tenantId = profile.tenant_id || null;
  next();
}

module.exports = { authenticate };
