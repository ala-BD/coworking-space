// server.js — Backend Dev 1 + Dev 2 (Modules A, B, C)
// S1 : Auth JWT, profils, abonnements, réservations
// S2 Dev 2 : Paiements complets, reçus PDF, relances impayés
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { generateReceiptPDF } = require('./utils/generateReceipt');
const { sendReceiptEmail, isEmailConfigured } = require('./utils/sendEmail');
const { startPaymentRemindersCron } = require('./cron/paymentReminders');
const { startReservationRemindersCron } = require('./cron/reservationReminders');
const { startSubscriptionRemindersCron } = require('./cron/subscriptionReminders');
const {
  notifyNouveauMembre,
  notifyConfirmationReservation,
  notifyAnnulationReservation,
  notifyPaiementEnregistre
} = require('./services/notificationService');
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
    message: 'VC LOW Coworking API — Modules A, B, C',
    modules: [
      'A — Membres & Abonnements (Dev 1)',
      'B — Réservations & Disponibilité (Dev 1)',
      'C — Paiements & Encaissements (Dev 2)',
    ],
    version: '1.1.0 (S1)',
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

// POST /api/members/welcome — Envoyer l'email de bienvenue (Module F)
app.post('/api/members/welcome', authenticate, async (req, res) => {
  const { userId } = req.body;
  const targetUserId = userId || req.user.id; // Si pas d'userId fourni, utiliser l'utilisateur courant

  try {
    // Récupérer les infos du membre
    const { data: membre, error } = await supabaseAdmin
      .from('profiles')
      .select('id, nom, prenom, email')
      .eq('id', targetUserId)
      .single();

    if (error || !membre) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }

    // ══ MODULE F : Notification nouveau membre ══════════════════════════
    await notifyNouveauMembre(supabaseAdmin, {
      id: membre.id,
      nom: membre.nom,
      prenom: membre.prenom,
      email: membre.email
    });
    // ═══════════════════════════════════════════════════════════════

    res.json({ message: 'Email de bienvenue envoyé avec succès.', membre });
  } catch (err) {
    console.error('Erreur envoi email bienvenue:', err);
    res.status(500).json({ error: err.message });
  }
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

  // ══ MODULE F : Notification de confirmation de réservation ═══════════════
  try {
    await notifyConfirmationReservation(
      supabaseAdmin,
      {
        id: data.id,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        espaces: data.espaces
      },
      {
        id: req.user.id,
        nom: req.profile.nom,
        prenom: req.profile.prenom,
        email: req.user.email
      }
    );
  } catch (notifErr) {
    console.error('⚠️  Échec notification confirmation réservation:', notifErr.message);
    // Ne pas bloquer la réponse si la notification échoue
  }
  // ═══════════════════════════════════════════════════════════════

  res.status(201).json({ reservation: data });
});

// DELETE /api/bookings/:id — Annuler une réservation
app.delete('/api/bookings/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  try {
    // Récupérer la réservation avec les infos nécessaires
    const { data: reservation, error: fetchErr } = await supabaseAdmin
      .from('reservations')
      .select('*, espaces(nom, type)')
      .eq('id', id)
      .single();

    if (fetchErr || !reservation) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    // Vérifier les droits : propriétaire ou staff
    if (!isStaff && reservation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez annuler que vos propres réservations.' });
    }

    // Supprimer ou marquer comme annulée
    const { error: deleteErr } = await supabaseAdmin
      .from('reservations')
      .update({ statut: 'cancelled' })
      .eq('id', id);

    if (deleteErr) {
      return res.status(400).json({ error: deleteErr.message });
    }

    // ══ MODULE F : Notification d'annulation ═════════════════════════════
    try {
      await notifyAnnulationReservation(
        supabaseAdmin,
        {
          id: reservation.id,
          date_debut: reservation.date_debut,
          date_fin: reservation.date_fin,
          espaces: reservation.espaces
        },
        {
          id: reservation.user_id,
          nom: req.profile.nom,
          prenom: req.profile.prenom,
          email: req.user.email
        }
      );
    } catch (notifErr) {
      console.error('⚠️  Échec notification annulation réservation:', notifErr.message);
    }
    // ═══════════════════════════════════════════════════════════════

    res.json({ message: 'Réservation annulée avec succès.', reservation });
  } catch (err) {
    console.error('Erreur annulation réservation:', err);
    res.status(500).json({ error: err.message });
  }
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

// =========================================================================
// MODULE C — Paiements & Encaissements (Dev 2 — S1)
// =========================================================================

// POST /api/payments — Créer un paiement (admin/staff uniquement)
app.post('/api/payments', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { user_id, reservation_id, abonnement_id, montant, mode, statut, date_paiement } = req.body;

  // Validation des champs requis
  if (!user_id || !montant || !mode) {
    return res.status(400).json({ error: 'user_id, montant et mode sont requis.' });
  }

  // Validation : au moins une référence (réservation OU abonnement)
  if (!reservation_id && !abonnement_id) {
    return res.status(400).json({ error: 'Un paiement doit être lié à une réservation ou un abonnement.' });
  }

  // Validation du mode de paiement
  const validModes = ['cash', 'bank_transfer', 'check', 'online'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'Mode de paiement invalide. Valeurs acceptées : cash, bank_transfer, check, online.' });
  }

  // Validation du statut (si fourni)
  const validStatuts = ['pending', 'paid', 'failed', 'refunded'];
  if (statut && !validStatuts.includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : pending, paid, failed, refunded.' });
  }

  // Validation du montant
  if (montant <= 0) {
    return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
  }

  // Vérifier que le membre existe
  const { data: member, error: memberError } = await supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email')
    .eq('id', user_id)
    .single();

  if (memberError || !member) {
    return res.status(404).json({ error: 'Membre introuvable.' });
  }

  // Vérifier que la réservation existe (si fournie)
  if (reservation_id) {
    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, user_id')
      .eq('id', reservation_id)
      .single();

    if (resError || !reservation) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    // Vérifier que la réservation appartient au membre
    if (reservation.user_id !== user_id) {
      return res.status(400).json({ error: 'La réservation n\'appartient pas à ce membre.' });
    }
  }

  // Vérifier que l'abonnement existe (si fourni)
  if (abonnement_id) {
    const { data: abonnement, error: abError } = await supabaseAdmin
      .from('abonnements')
      .select('id, user_id')
      .eq('id', abonnement_id)
      .single();

    if (abError || !abonnement) {
      return res.status(404).json({ error: 'Abonnement introuvable.' });
    }

    // Vérifier que l'abonnement appartient au membre
    if (abonnement.user_id !== user_id) {
      return res.status(400).json({ error: 'L\'abonnement n\'appartient pas à ce membre.' });
    }
  }

  // Créer le paiement
  const paymentData = {
    user_id,
    reservation_id: reservation_id || null,
    abonnement_id: abonnement_id || null,
    montant: parseFloat(montant),
    mode,
    statut: statut || 'pending',
    date_paiement: date_paiement || null,
  };

  const { data, error } = await supabaseAdmin
    .from('paiements')
    .insert(paymentData)
    .select('*, profiles(nom, prenom, email)')
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ payment: data, message: 'Paiement créé avec succès.' });
});

// GET /api/payments — Liste tous les paiements (admin/staff uniquement)
app.get('/api/payments', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { statut, mode, user_id, limit = 50, offset = 0 } = req.query;

  try {
    // Construction de la requête avec filtres optionnels
    let query = supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email, type_membre),
        reservations(date_debut, date_fin, espaces(nom)),
        abonnements(type, date_debut, date_fin)
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filtres optionnels
    if (statut) {
      query = query.eq('statut', statut);
    }

    if (mode) {
      query = query.eq('mode', mode);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      payments: data,
      total: data.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erreur récupération paiements:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/member/:memberId — Paiements d'un membre spécifique
app.get('/api/payments/member/:memberId', authenticate, async (req, res) => {
  const { memberId } = req.params;
  const isSelf = memberId === req.user.id;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  // Vérification des droits : membre peut voir ses propres paiements, ou être admin/staff
  if (!isSelf && !isStaff) {
    return res.status(403).json({ error: 'Accès refusé. Vous ne pouvez consulter que vos propres paiements.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email),
        reservations(date_debut, date_fin, espaces(nom, type)),
        abonnements(type, date_debut, date_fin)
      `)
      .eq('user_id', memberId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculer les statistiques
    const stats = {
      total_paiements: data.length,
      total_montant: data.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0),
      pending: data.filter(p => p.statut === 'pending').length,
      paid: data.filter(p => p.statut === 'paid').length,
      failed: data.filter(p => p.statut === 'failed').length,
      refunded: data.filter(p => p.statut === 'refunded').length,
    };

    res.json({
      payments: data,
      statistics: stats,
    });
  } catch (err) {
    console.error('Erreur récupération paiements membre:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/pending — Liste des paiements impayés (admin/staff uniquement)
app.get('/api/payments/pending', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email, telephone),
        reservations(date_debut, date_fin, espaces(nom)),
        abonnements(type, date_debut, date_fin)
      `)
      .eq('statut', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculer le total des impayés
    const totalImpaye = data.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);

    // Identifier les paiements en retard (créés il y a plus de 3 jours)
    const today = new Date();
    const paymentsEnRetard = data.filter(p => {
      const createdDate = new Date(p.created_at);
      const diffTime = Math.abs(today - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 3;
    });

    res.json({
      pending_payments: data,
      total_count: data.length,
      total_amount: totalImpaye,
      overdue_count: paymentsEnRetard.length,
      overdue_payments: paymentsEnRetard,
    });
  } catch (err) {
    console.error('Erreur récupération paiements pending:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/payments/:id — Mettre à jour un paiement (admin/staff uniquement)
app.patch('/api/payments/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { statut, mode, montant, date_paiement } = req.body;
  const updates = {};

  // Validation du statut
  if (statut !== undefined) {
    const validStatuts = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : pending, paid, failed, refunded.' });
    }
    updates.statut = statut;

    // Si le statut passe à "paid" et qu'aucune date n'est fournie, utiliser la date actuelle
    if (statut === 'paid' && !date_paiement) {
      updates.date_paiement = new Date().toISOString();
    }
  }

  // Validation du mode
  if (mode !== undefined) {
    const validModes = ['cash', 'bank_transfer', 'check', 'online'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Mode de paiement invalide. Valeurs acceptées : cash, bank_transfer, check, online.' });
    }
    updates.mode = mode;
  }

  // Validation du montant
  if (montant !== undefined) {
    if (montant <= 0) {
      return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
    }
    updates.montant = parseFloat(montant);
  }

  // Mise à jour de la date de paiement
  if (date_paiement !== undefined) {
    updates.date_paiement = date_paiement;
  }

  // Vérifier qu'il y a au moins une mise à jour
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  try {
    // Vérifier que le paiement existe
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('paiements')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }

    // Effectuer la mise à jour
    const { data, error } = await supabaseAdmin
      .from('paiements')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        profiles(nom, prenom, email),
        reservations(date_debut, date_fin, espaces(nom)),
        abonnements(type, date_debut, date_fin)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // ══ MODULE F : Notification de paiement enregistré ═══════════════════════
    if (statut === 'paid') {
      try {
        // Notification via le nouveau service Module F
        await notifyPaiementEnregistre(
          supabaseAdmin,
          {
            id: data.id,
            montant: data.montant,
            mode: data.mode,
            statut: data.statut,
            date_paiement: data.date_paiement,
            numero_recu: data.numero_recu,
            reservations: data.reservations,
            abonnements: data.abonnements
          },
          {
            id: data.user_id,
            nom: data.profiles.nom,
            prenom: data.profiles.prenom,
            email: data.profiles.email
          }
        );

        // Générer et envoyer le PDF du reçu (ancien système Module C)
        if (isEmailConfigured()) {
          const pdfBuffer = await generateReceiptPDF(data, {
            coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
            coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
            coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
            coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
          });

          await sendReceiptEmail(data, pdfBuffer, {
            coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
            coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
            coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
          });

          console.log(`✓ Email reçu PDF envoyé pour paiement ${data.numero_recu || data.id}`);
        }
      } catch (emailErr) {
        console.error('⚠️  Échec notification/email paiement:', emailErr.message);
      }
    }
    // ═══════════════════════════════════════════════════════════════

    res.json({ payment: data, message: 'Paiement mis à jour avec succès.' });
  } catch (err) {
    console.error('Erreur mise à jour paiement:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// MODULE C — Reçu PDF d'un paiement (Dev 2 — S2)
// =========================================================================

// GET /api/payments/:id/receipt — Télécharger le reçu PDF d'un paiement
app.get('/api/payments/:id/receipt', authenticate, async (req, res) => {
  const { id } = req.params;
  const isSelf = req.profile.role === 'member';
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  try {
    // Récupérer le paiement avec toutes les jointures nécessaires
    const { data: payment, error } = await supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email, telephone),
        reservations(date_debut, date_fin, espaces(nom, type)),
        abonnements(type, date_debut, date_fin)
      `)
      .eq('id', id)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }

    // Vérification des droits : membre ne peut voir que ses propres reçus
    if (isSelf && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé. Ce reçu ne vous appartient pas.' });
    }

    // Générer le PDF
    const pdfBuffer = await generateReceiptPDF(payment, {
      coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
      coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
      coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
      coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
    });

    const filename = `recu-${payment.numero_recu || payment.id}.pdf`;

    // Envoyer le PDF en réponse
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Erreur génération reçu PDF:', err);
    res.status(500).json({ error: 'Impossible de générer le reçu PDF : ' + err.message });
  }
});

// =========================================================================
// MODULE C — Option : Intégration Paiement Flouci
// =========================================================================

async function finalizeOnlinePayment(paymentId, userId, referenceExterne) {
  const { data: updatedPayment, error } = await supabaseAdmin
    .from('paiements')
    .update({
      statut: 'paid',
      mode: 'online',
      date_paiement: new Date().toISOString(),
      ...(referenceExterne ? { reference_externe: referenceExterne } : {}),
    })
    .eq('id', paymentId)
    .eq('user_id', userId)
    .select(`
      *,
      profiles(nom, prenom, email, telephone),
      reservations(date_debut, date_fin, espaces(nom, type)),
      abonnements(type, date_debut, date_fin)
    `)
    .single();

  if (error) throw error;

  if (isEmailConfigured()) {
    try {
      const pdfBuffer = await generateReceiptPDF(updatedPayment, {
        coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
        coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
        coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
        coworkingAdresse: process.env.COWORKING_ADRESSE || 'Tunis, Tunisie',
      });
      await sendReceiptEmail(updatedPayment, pdfBuffer, {
        coworkingName: process.env.COWORKING_NAME || 'Thirty Three Space',
        coworkingEmail: process.env.COWORKING_EMAIL || 'contact@33space.tn',
        coworkingTel: process.env.COWORKING_TEL || '+216 XX XXX XXX',
      });
    } catch (emailErr) {
      console.error('Avertissement : échec envoi email après Flouci:', emailErr.message);
    }
  }

  return updatedPayment;
}

// POST /api/flouci/pay — Générer le lien de paiement Flouci
app.post('/api/flouci/pay', authenticate, async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'paymentId requis' });

  try {
    if (!process.env.FLOUCI_APP_TOKEN || !process.env.FLOUCI_APP_SECRET) {
      return res.status(503).json({
        error: 'Flouci non configuré. Ajoutez FLOUCI_APP_TOKEN et FLOUCI_APP_SECRET dans .env.',
      });
    }

    const { data: payment, error } = await supabaseAdmin
      .from('paiements')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !payment) return res.status(404).json({ error: 'Paiement introuvable.' });
    if (payment.statut === 'paid') return res.status(400).json({ error: 'Ce paiement est déjà réglé.' });

    const amountInMillimes = Math.round(parseFloat(payment.montant) * 1000);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    const payload = {
      app_token: process.env.FLOUCI_APP_TOKEN,
      app_secret: process.env.FLOUCI_APP_SECRET,
      amount: amountInMillimes.toString(),
      accept_url: `${FRONTEND_URL}/member/payments/verify?paymentId=${paymentId}`,
      cancel_url: `${FRONTEND_URL}/member/payments`,
      session_timeout_secs: 1200,
      success_link: `${FRONTEND_URL}/member/payments/verify?paymentId=${paymentId}`,
      fail_link: `${FRONTEND_URL}/member/payments`,
      developer_tracking_id: paymentId,
    };

    const flouciRes = await axios.post('https://developers.flouci.com/api/generate_payment', payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (flouciRes.data && flouciRes.data.result) {
      const flouciPaymentId = flouciRes.data.result.payment_id;
      if (flouciPaymentId) {
        await supabaseAdmin
          .from('paiements')
          .update({ reference_externe: flouciPaymentId })
          .eq('id', paymentId);
      }
      res.json({ link: flouciRes.data.result.link, payment_id: flouciPaymentId });
    } else {
      res.status(500).json({ error: 'Erreur inattendue depuis Flouci.' });
    }
  } catch (err) {
    console.error('Erreur Flouci Pay:', err.message);
    res.status(500).json({ error: 'Impossible de contacter la passerelle Flouci.' });
  }
});

// POST /api/flouci/verify — Vérifier le statut du paiement Flouci
app.post('/api/flouci/verify', authenticate, async (req, res) => {
  const { paymentId, payment_id: flouciPaymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'paymentId requis' });

  try {
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('paiements')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !payment) return res.status(404).json({ error: 'Paiement introuvable.' });

    if (payment.statut === 'paid') {
      return res.json({ success: true, payment });
    }

    const txId = flouciPaymentId || payment.reference_externe;
    if (!txId) {
      return res.status(400).json({ error: 'Référence transaction Flouci manquante.' });
    }

    const flouciRes = await axios.get(`https://developers.flouci.com/api/verify_payment/${txId}`, {
      headers: {
        apppublic: process.env.FLOUCI_APP_TOKEN,
        appsecret: process.env.FLOUCI_APP_SECRET,
      },
    });

    if (flouciRes.data?.result?.status === 'SUCCESS') {
      const updatedPayment = await finalizeOnlinePayment(paymentId, req.user.id, txId);
      return res.json({ success: true, payment: updatedPayment });
    }

    res.json({ success: false, message: "Le paiement n'a pas été validé par Flouci." });
  } catch (err) {
    console.error('Erreur Flouci Verify:', err.message);
    res.status(500).json({ error: 'Erreur lors de la vérification Flouci' });
  }
});

// Démarrage des tâches planifiées (Cron)
startPaymentRemindersCron(supabaseAdmin);
startReservationRemindersCron(supabaseAdmin);
startSubscriptionRemindersCron(supabaseAdmin);

app.listen(PORT, () => {
  console.log(`API Dev 1 + Dev 2 démarrée sur http://localhost:${PORT}`);
  console.log('✅ Module F - Notifications automatiques activées.');
});
