// server.js — Backend Dev 1 (Modules A, B schéma)
// Périmètre S1 : Auth JWT, profils, abonnements, vérification disponibilité réservations
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Variables SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY requises.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());
app.use(express.json());

const SUBSCRIPTION_DURATIONS = {
  day_pass: 1,
  week_pass: 7,
  mensuel: 30,
  trimestriel: 90,
  annuel: 365,
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getUserClient(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

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
    return res.status(403).json({ error: 'Compte suspendu ou expiré.' });
  }

  req.user = data.user;
  req.profile = profile;
  req.token = token;
  req.db = getUserClient(token);
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Droits insuffisants pour cette action.' });
    }
    next();
  };
}

app.get('/', (_req, res) => {
  res.json({
    message: 'VC LOW Coworking API — Dev 1 (Membres & Réservations)',
    modules: ['A — Membres & Abonnements', 'B — Vérification disponibilité'],
  });
});

// =========================================================================
// MODULE A — Profils membres
// =========================================================================

app.get('/api/members/me', authenticate, async (req, res) => {
  res.json({ profile: req.profile });
});

app.put('/api/members/me', authenticate, async (req, res) => {
  const allowed = ['nom', 'prenom', 'telephone', 'cin', 'type_membre'];
  const updates = {};

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucun champ modifiable fourni.' });
  }

  const validTypes = ['individuel', 'entreprise', 'etudiant'];
  if (updates.type_membre && !validTypes.includes(updates.type_membre)) {
    return res.status(400).json({ error: 'type_membre invalide.' });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await req.db
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ profile: data });
});

app.get('/api/members', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ members: data });
});

app.get('/api/members/:id', authenticate, async (req, res) => {
  const isSelf = req.params.id === req.user.id;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  if (!isSelf && !isStaff) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Membre introuvable.' });
  }

  res.json({ profile: data });
});

// =========================================================================
// MODULE A — Abonnements
// =========================================================================

app.get('/api/subscriptions/me', authenticate, async (req, res) => {
  const { data, error } = await req.db
    .from('abonnements')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date_debut', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ subscriptions: data });
});

app.get('/api/subscriptions/me/active', authenticate, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await req.db
    .from('abonnements')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('statut', 'active')
    .lte('date_debut', today)
    .gte('date_fin', today)
    .order('date_fin', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ subscription: data });
});

app.post('/api/subscriptions', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { user_id, type, date_debut, renouvellement_auto } = req.body;

  if (!user_id || !type || !date_debut) {
    return res.status(400).json({ error: 'user_id, type et date_debut sont requis.' });
  }

  if (!SUBSCRIPTION_DURATIONS[type] && type !== 'bureau_prive') {
    return res.status(400).json({ error: 'Type d\'abonnement invalide.' });
  }

  let date_fin = req.body.date_fin;
  if (!date_fin) {
    if (type === 'bureau_prive') {
      return res.status(400).json({ error: 'date_fin requise pour bureau_prive.' });
    }
    date_fin = addDays(date_debut, SUBSCRIPTION_DURATIONS[type] - 1);
  }

  if (date_fin < date_debut) {
    return res.status(400).json({ error: 'date_fin doit être >= date_debut.' });
  }

  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .insert({
      user_id,
      type,
      date_debut,
      date_fin,
      renouvellement_auto: Boolean(renouvellement_auto),
      statut: 'active',
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ subscription: data });
});

app.patch('/api/subscriptions/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { statut, renouvellement_auto, date_fin } = req.body;
  const updates = {};

  if (statut !== undefined) {
    if (!['active', 'suspended', 'expired'].includes(statut)) {
      return res.status(400).json({ error: 'statut invalide.' });
    }
    updates.statut = statut;
  }

  if (renouvellement_auto !== undefined) {
    updates.renouvellement_auto = Boolean(renouvellement_auto);
  }

  if (date_fin !== undefined) {
    updates.date_fin = date_fin;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ subscription: data });
});

app.get('/api/subscriptions', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .select('*, profiles(nom, prenom, email)')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ subscriptions: data });
});

// =========================================================================
// MODULE B — Réservations (préparation S2)
// =========================================================================

app.get('/api/bookings/calendar', authenticate, async (req, res) => {
  const { espace_id, from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Paramètres from et to requis (ISO date).' });
  }

  let query = supabaseAdmin
    .from('reservations')
    .select('id, espace_id, user_id, date_debut, date_fin, statut, mode, espaces(nom, type)')
    .in('statut', ['confirmed', 'pending'])
    .gte('date_debut', from)
    .lte('date_debut', to)
    .order('date_debut', { ascending: true });

  if (espace_id) {
    query = query.eq('espace_id', espace_id);
  }

  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  if (!isStaff) {
    query = query.eq('user_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ reservations: data });
});

app.post('/api/bookings', authenticate, async (req, res) => {
  const { espace_id, date_debut, date_fin, mode } = req.body;

  if (!espace_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'espace_id, date_debut et date_fin sont requis.' });
  }

  if (new Date(date_debut) >= new Date(date_fin)) {
    return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  const { data: overlaps } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('espace_id', espace_id)
    .in('statut', ['confirmed', 'pending'])
    .lt('date_debut', date_fin)
    .gt('date_fin', date_debut);

  if (overlaps?.length > 0) {
    return res.status(409).json({ error: 'Conflit : ce créneau est déjà réservé.', overlapsCount: overlaps.length });
  }

  const { data, error } = await req.db
    .from('reservations')
    .insert({
      user_id: req.user.id,
      espace_id,
      date_debut,
      date_fin,
      statut: 'pending',
      mode: mode || 'online',
    })
    .select('*, espaces(nom, type)')
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ reservation: data });
});

app.post('/api/bookings/check-availability', authenticate, async (req, res) => {
  const { espace_id, date_debut, date_fin, exclude_reservation_id } = req.body;

  if (!espace_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'espace_id, date_debut et date_fin sont requis.' });
  }

  if (new Date(date_debut) >= new Date(date_fin)) {
    return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  try {
    let query = supabaseAdmin
      .from('reservations')
      .select('id, date_debut, date_fin, statut')
      .eq('espace_id', espace_id)
      .in('statut', ['confirmed', 'pending'])
      .lt('date_debut', date_fin)
      .gt('date_fin', date_debut);

    if (exclude_reservation_id) {
      query = query.neq('id', exclude_reservation_id);
    }

    const { data: overlaps, error } = await query;
    if (error) throw error;

    res.json({
      isAvailable: overlaps.length === 0,
      overlapsCount: overlaps.length,
    });
  } catch (err) {
    console.error('Erreur disponibilité:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API Dev 1 démarrée sur http://localhost:${PORT}`);
});
