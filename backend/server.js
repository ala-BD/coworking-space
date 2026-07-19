// server.js — Backend Dev 1 + Dev 2 (Modules A, B, C)
// S1 : Auth JWT, profils, abonnements, réservations
// S2 Dev 1 : Tarifs, promo, réservations UI
// S3 Dev 1 : Agenda admin, check-in/out, politique annulation, profils A1
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { generateReceiptPDF } = require('./utils/generateReceipt');
const { sendReceiptEmail, isEmailConfigured } = require('./utils/sendEmail');
const { finalizeOnlinePayment } = require('./services/onlinePaymentService');
const {
  isStripeConfigured,
  createCheckoutSession,
  retrieveCheckoutSession,
  validateCheckoutSession,
  isCheckoutSessionPaid,
  getExternalReference,
  constructWebhookEvent,
} = require('./services/stripeService');
const { startPaymentRemindersCron } = require('./cron/paymentReminders');
const { startReservationRemindersCron } = require('./cron/reservationReminders');
const { startSubscriptionRemindersCron } = require('./cron/subscriptionReminders');
const { initSocket, emitSessionStarted, emitSessionEnded, emitSessionOvertime } = require('./services/socketService');
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

// Stripe webhook — doit recevoir le body brut (avant express.json)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Signature Stripe manquante.');

  try {
    const event = constructWebhookEvent(req.body, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;

      if (paymentId && userId && isCheckoutSessionPaid(session)) {
        await finalizeOnlinePayment(
          supabaseAdmin,
          paymentId,
          userId,
          getExternalReference(session)
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Erreur Stripe Webhook:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(express.json());

const SUBSCRIPTION_DURATIONS = {
  day_pass: 1,
  week_pass: 7,
  mensuel: 30,
  trimestriel: 90,
  annuel: 365,
};

const MEMBER_TYPE_TO_PLAN = {
  individuel: 'standard',
  etudiant: 'etudiant',
  entreprise: 'entreprise',
};

const SUBSCRIPTION_LABELS = {
  day_pass: 'Day Pass',
  week_pass: 'Week Pass',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  bureau_prive: 'Bureau privé',
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isDateInRange(dateStr, startStr, endStr) {
  const d = dateStr || todayISO();
  if (startStr && d < startStr) return false;
  if (endStr && d > endStr) return false;
  return true;
}

function applyPromoDiscount(prix, promo) {
  if (!promo) return { prixFinal: prix, reduction: 0 };
  let reduction = promo.type_reduction === 'percent'
    ? (prix * promo.valeur) / 100
    : promo.valeur;
  reduction = Math.min(reduction, prix);
  return { prixFinal: Math.max(0, prix - reduction), reduction };
}

async function findActiveTarif(typeAbonnement, planTarifaire) {
  const today = todayISO();
  const { data, error } = await supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .eq('type_abonnement', typeAbonnement)
    .eq('plan_tarifaire', planTarifaire)
    .eq('actif', true)
    .lte('date_debut', today)
    .order('date_debut', { ascending: false });

  if (error) throw error;
  const tarif = (data || []).find((t) => !t.date_fin || t.date_fin >= today);
  return tarif || null;
}

async function findValidPromoCode(code) {
  const today = todayISO();
  const { data, error } = await supabaseAdmin
    .from('codes_promo')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('actif', true)
    .single();

  if (error || !data) return null;
  if (!isDateInRange(today, data.date_debut, data.date_fin)) return null;
  if (data.utilisations_max != null && data.utilisations_count >= data.utilisations_max) return null;
  return data;
}

function sanitizeProfileForClient(profile, isStaff) {
  const copy = { ...profile };
  if (!isStaff) {
    delete copy.notes_admin;
  }
  return copy;
}

async function getCancellationPolicy() {
  const { data } = await supabaseAdmin
    .from('politique_annulation')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || {
    delai_heures: 24,
    penalite_pct: 0,
    annulation_membre_autorisee: true,
    remboursement_auto: false,
    message_membre: 'Annulation gratuite jusqu\'à 24 h avant le début du créneau.',
  };
}

function evaluateCancellation(reservation, policy, isStaff) {
  if (isStaff) {
    return { allowed: true, penalite_pct: 0 };
  }
  if (!policy.annulation_membre_autorisee) {
    return { allowed: false, reason: 'Les annulations en ligne sont désactivées. Contactez l\'accueil.' };
  }
  const hoursUntilStart = (new Date(reservation.date_debut).getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < policy.delai_heures) {
    return {
      allowed: false,
      reason: `Annulation impossible moins de ${policy.delai_heures} h avant le début.`,
      hoursUntilStart: Number(hoursUntilStart.toFixed(1)),
    };
  }
  return { allowed: true, penalite_pct: Number(policy.penalite_pct || 0) };
}

async function hasActiveSubscription(userId) {
  const today = todayISO();
  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .select('id')
    .eq('user_id', userId)
    .eq('statut', 'active')
    .lte('date_debut', today)
    .gte('date_fin', today)
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}

async function ensureQrToken(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('qr_token')
    .eq('id', userId)
    .single();

  if (profile?.qr_token) return profile.qr_token;

  const token = crypto.randomUUID();
  await supabaseAdmin.from('profiles').update({ qr_token: token }).eq('id', userId);
  return token;
}

function computeRemainingMinutes(dateFin) {
  return Math.max(0, Math.round((new Date(dateFin).getTime() - Date.now()) / 60000));
}

async function hasBookingOverlap(espaceId, dateDebut, dateFin, excludeId = null) {
  let query = supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('espace_id', espaceId)
    .in('statut', ['confirmed', 'pending'])
    .lt('date_debut', dateFin)
    .gt('date_fin', dateDebut);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
}

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
    version: '1.3.0 (S3 Dev1)',
  });
});

// =========================================================================
// MODULE A — Profils membres
// =========================================================================

app.get('/api/members/me', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  await ensureQrToken(req.user.id);
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error || !profile) {
    return res.status(404).json({ error: 'Profil introuvable.' });
  }

  res.json({ profile: sanitizeProfileForClient(profile, isStaff) });
});

app.put('/api/members/me', authenticate, async (req, res) => {
  const allowed = ['nom', 'prenom', 'telephone', 'cin', 'type_membre', 'photo_url'];
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

  res.json({ profile: sanitizeProfileForClient(data, false) });
});

app.post('/api/members/me/documents', authenticate, async (req, res) => {
  const { name, url, type } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name et url sont requis.' });
  }

  const doc = {
    name,
    url,
    type: type || 'justificatif',
    uploaded_at: new Date().toISOString(),
  };

  const currentDocs = Array.isArray(req.profile.documents) ? req.profile.documents : [];
  const documents = [...currentDocs, doc];

  const { data, error } = await req.db
    .from('profiles')
    .update({ documents, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ profile: sanitizeProfileForClient(data, false), document: doc });
});

app.delete('/api/members/me/documents/:index', authenticate, async (req, res) => {
  const index = Number(req.params.index);
  const currentDocs = Array.isArray(req.profile.documents) ? [...req.profile.documents] : [];

  if (Number.isNaN(index) || index < 0 || index >= currentDocs.length) {
    return res.status(404).json({ error: 'Document introuvable.' });
  }

  currentDocs.splice(index, 1);

  const { data, error } = await req.db
    .from('profiles')
    .update({ documents: currentDocs, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: sanitizeProfileForClient(data, false) });
});

app.get('/api/members/me/qr', authenticate, async (req, res) => {
  const qr_token = await ensureQrToken(req.user.id);
  res.json({
    qr_token,
    payload: JSON.stringify({ user_id: req.user.id, qr_token }),
    member: {
      id: req.user.id,
      nom: req.profile.nom,
      prenom: req.profile.prenom,
      statut_compte: req.profile.statut_compte,
    },
  });
});

app.patch('/api/members/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { notes_admin, statut_compte } = req.body;
  const updates = { updated_at: new Date().toISOString() };

  if (notes_admin !== undefined) updates.notes_admin = notes_admin;
  if (statut_compte !== undefined) {
    if (!['actif', 'suspendu', 'expire'].includes(statut_compte)) {
      return res.status(400).json({ error: 'statut_compte invalide.' });
    }
    updates.statut_compte = statut_compte;
  }

  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
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

  res.json({ profile: sanitizeProfileForClient(data, isStaff) });
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
  const { user_id, type, date_debut, renouvellement_auto, code_promo, plan_tarifaire } = req.body;

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

  const { data: memberProfile, error: memberErr } = await supabaseAdmin
    .from('profiles')
    .select('type_membre')
    .eq('id', user_id)
    .single();

  if (memberErr || !memberProfile) {
    return res.status(404).json({ error: 'Membre introuvable.' });
  }

  const plan = plan_tarifaire || MEMBER_TYPE_TO_PLAN[memberProfile.type_membre] || 'standard';
  let tarifInfo = null;
  let promoInfo = null;

  try {
    const tarif = await findActiveTarif(type, plan);
    if (tarif) {
      tarifInfo = tarif;
      if (code_promo) {
        promoInfo = await findValidPromoCode(code_promo);
        if (!promoInfo) {
          return res.status(400).json({ error: 'Code promo invalide ou expiré.' });
        }
      }
    }
  } catch (pricingErr) {
    console.warn('Tarification non disponible (migration S2 Dev1 ?):', pricingErr.message);
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

  let pricingResult = null;
  if (tarifInfo) {
    const { prixFinal, reduction } = applyPromoDiscount(Number(tarifInfo.prix), promoInfo);
    pricingResult = {
      type_abonnement: type,
      plan_tarifaire: plan,
      prix_initial: Number(tarifInfo.prix),
      prix_final: prixFinal,
      reduction,
      tva_pct: Number(tarifInfo.tva_pct),
      code_promo: promoInfo?.code || null,
    };

    await supabaseAdmin.from('historique_tarifs').insert({
      user_id,
      abonnement_id: data.id,
      type_abonnement: type,
      plan_tarifaire: plan,
      prix_initial: Number(tarifInfo.prix),
      prix_final: prixFinal,
      code_promo_id: promoInfo?.id || null,
    });

    if (promoInfo) {
      await supabaseAdmin
        .from('codes_promo')
        .update({ utilisations_count: promoInfo.utilisations_count + 1 })
        .eq('id', promoInfo.id);
    }
  }

  res.status(201).json({ subscription: data, pricing: pricingResult });
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
// MODULE A — Tarification & codes promo (S2 Dev 1 — CDC A3)
// =========================================================================

app.get('/api/pricing', authenticate, async (req, res) => {
  const plan = req.query.plan_tarifaire
    || MEMBER_TYPE_TO_PLAN[req.profile.type_membre]
    || 'standard';
  const today = todayISO();

  const { data, error } = await supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .eq('plan_tarifaire', plan)
    .eq('actif', true)
    .lte('date_debut', today)
    .order('type_abonnement', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const tarifs = (data || []).filter((t) => !t.date_fin || t.date_fin >= today);
  res.json({
    plan_tarifaire: plan,
    tarifs: tarifs.map((t) => ({
      ...t,
      label: SUBSCRIPTION_LABELS[t.type_abonnement] || t.type_abonnement,
      duree_jours: SUBSCRIPTION_DURATIONS[t.type_abonnement] || null,
    })),
  });
});

app.get('/api/pricing/all', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .order('type_abonnement', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tarifs: data });
});

app.post('/api/pricing', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { type_abonnement, plan_tarifaire, prix, tva_pct, date_debut, date_fin, actif } = req.body;

  if (!type_abonnement || !plan_tarifaire || prix == null) {
    return res.status(400).json({ error: 'type_abonnement, plan_tarifaire et prix sont requis.' });
  }

  const { data, error } = await supabaseAdmin
    .from('tarifs_abonnements')
    .insert({
      type_abonnement,
      plan_tarifaire,
      prix,
      tva_pct: tva_pct ?? 19,
      date_debut: date_debut || todayISO(),
      date_fin: date_fin || null,
      actif: actif !== false,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ tarif: data });
});

app.patch('/api/pricing/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const allowed = ['prix', 'tva_pct', 'date_debut', 'date_fin', 'actif'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  const { data, error } = await supabaseAdmin
    .from('tarifs_abonnements')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ tarif: data });
});

app.post('/api/promo-codes/validate', authenticate, async (req, res) => {
  const { code, type_abonnement, plan_tarifaire } = req.body;

  if (!code || !type_abonnement) {
    return res.status(400).json({ error: 'code et type_abonnement sont requis.' });
  }

  const plan = plan_tarifaire
    || MEMBER_TYPE_TO_PLAN[req.profile.type_membre]
    || 'standard';

  try {
    const promo = await findValidPromoCode(code);
    if (!promo) {
      return res.status(404).json({ valid: false, error: 'Code promo invalide ou expiré.' });
    }

    const tarif = await findActiveTarif(type_abonnement, plan);
    if (!tarif) {
      return res.status(404).json({ valid: false, error: 'Tarif introuvable pour cet abonnement.' });
    }

    const prixInitial = Number(tarif.prix);
    const { prixFinal, reduction } = applyPromoDiscount(prixInitial, promo);

    res.json({
      valid: true,
      code: promo.code,
      type_reduction: promo.type_reduction,
      valeur: Number(promo.valeur),
      plan_tarifaire: plan,
      type_abonnement,
      prix_initial: prixInitial,
      prix_final: prixFinal,
      reduction,
      tva_pct: Number(tarif.tva_pct),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/promo-codes', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('codes_promo')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ promoCodes: data });
});

app.post('/api/promo-codes', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { code, type_reduction, valeur, date_debut, date_fin, utilisations_max, actif } = req.body;

  if (!code || !type_reduction || valeur == null) {
    return res.status(400).json({ error: 'code, type_reduction et valeur sont requis.' });
  }

  const { data, error } = await supabaseAdmin
    .from('codes_promo')
    .insert({
      code: code.toUpperCase(),
      type_reduction,
      valeur,
      date_debut: date_debut || todayISO(),
      date_fin: date_fin || null,
      utilisations_max: utilisations_max ?? null,
      actif: actif !== false,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ promoCode: data });
});

app.patch('/api/promo-codes/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const allowed = ['type_reduction', 'valeur', 'date_debut', 'date_fin', 'utilisations_max', 'actif'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  const { data, error } = await supabaseAdmin
    .from('codes_promo')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ promoCode: data });
});

app.get('/api/pricing/history/me', authenticate, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('historique_tarifs')
    .select('*, codes_promo(code, type_reduction, valeur)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data });
});

// =========================================================================
// MODULE B — Réservations (S2 Dev 1)
// =========================================================================

app.get('/api/espaces', authenticate, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('espaces')
    .select('*')
    .order('tarif_horaire', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ espaces: data });
});

app.get('/api/bookings/calendar', authenticate, async (req, res) => {
  const { espace_id, from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Paramètres from et to requis (ISO date).' });
  }

  let query = supabaseAdmin
    .from('reservations')
    .select('id, espace_id, user_id, date_debut, date_fin, statut, mode, espaces(nom, type), profiles(nom, prenom, email)')
    .in('statut', ['confirmed', 'pending'])
    .lt('date_debut', to)
    .gt('date_fin', from)
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

  const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin);
  if (overlap) {
    return res.status(409).json({ error: 'Conflit : ce créneau est déjà réservé.' });
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

    const policy = await getCancellationPolicy();
    const cancellation = evaluateCancellation(reservation, policy, isStaff);
    if (!cancellation.allowed) {
      return res.status(403).json({
        error: cancellation.reason,
        policy,
        hoursUntilStart: cancellation.hoursUntilStart,
      });
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

    res.json({
      message: 'Réservation annulée avec succès.',
      reservation,
      penalite_pct: cancellation.penalite_pct || 0,
    });
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
    const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin, exclude_reservation_id);
    res.json({
      isAvailable: !overlap,
      overlapsCount: overlap ? 1 : 0,
    });
  } catch (err) {
    console.error('Erreur disponibilité:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const { statut, espace_id, from, to } = req.query;

  let query = supabaseAdmin
    .from('reservations')
    .select('*, espaces(nom, type, tarif_horaire), profiles(nom, prenom, email)')
    .order('date_debut', { ascending: false });

  if (!isStaff) {
    query = query.eq('user_id', req.user.id);
  }

  if (statut) query = query.eq('statut', statut);
  if (espace_id) query = query.eq('espace_id', espace_id);
  if (from) query = query.gte('date_debut', from);
  if (to) query = query.lte('date_debut', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reservations: data });
});

app.get('/api/bookings/occupation', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Paramètres from et to requis (ISO date).' });
  }

  const { data: espaces, error: espErr } = await supabaseAdmin.from('espaces').select('id, nom, type, capacite');
  if (espErr) return res.status(500).json({ error: espErr.message });

  const { data: reservations, error: resErr } = await supabaseAdmin
    .from('reservations')
    .select('id, espace_id, date_debut, date_fin, statut')
    .in('statut', ['confirmed', 'pending'])
    .gte('date_debut', from)
    .lte('date_debut', to);

  if (resErr) return res.status(500).json({ error: resErr.message });

  const periodMs = new Date(to).getTime() - new Date(from).getTime();
  const report = (espaces || []).map((espace) => {
    const espaceReservations = (reservations || []).filter((r) => r.espace_id === espace.id);
    const reservedMs = espaceReservations.reduce((acc, r) => {
      return acc + (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime());
    }, 0);
    const taux = periodMs > 0 ? Math.min(100, (reservedMs / periodMs) * 100) : 0;

    return {
      espace_id: espace.id,
      nom: espace.nom,
      type: espace.type,
      capacite: espace.capacite,
      reservations_count: espaceReservations.length,
      taux_occupation_pct: Number(taux.toFixed(1)),
    };
  });

  res.json({ from, to, report });
});

app.patch('/api/bookings/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { date_debut, date_fin, statut } = req.body;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ error: 'Réservation introuvable.' });
  }

  if (!isStaff && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Modification non autorisée.' });
  }

  const newDebut = date_debut || existing.date_debut;
  const newFin = date_fin || existing.date_fin;

  if (new Date(newDebut) >= new Date(newFin)) {
    return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  if (date_debut || date_fin) {
    const overlap = await hasBookingOverlap(existing.espace_id, newDebut, newFin, id);
    if (overlap) {
      return res.status(409).json({ error: 'Conflit : ce créneau est déjà réservé.' });
    }
  }

  const updates = {};
  if (date_debut) updates.date_debut = date_debut;
  if (date_fin) updates.date_fin = date_fin;
  if (statut && isStaff) {
    if (!['pending', 'confirmed', 'cancelled'].includes(statut)) {
      return res.status(400).json({ error: 'statut invalide.' });
    }
    updates.statut = statut;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update(updates)
    .eq('id', id)
    .select('*, espaces(nom, type)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ reservation: data });
});

// =========================================================================
// MODULE B — Politique d'annulation (S3 Dev 1 — CDC B2)
// =========================================================================

app.get('/api/settings/cancellation-policy', authenticate, async (_req, res) => {
  const policy = await getCancellationPolicy();
  res.json({ policy });
});

app.patch('/api/settings/cancellation-policy', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const {
    delai_heures,
    penalite_pct,
    annulation_membre_autorisee,
    remboursement_auto,
    message_membre,
  } = req.body;

  const current = await getCancellationPolicy();
  const updates = {
    delai_heures: delai_heures ?? current.delai_heures,
    penalite_pct: penalite_pct ?? current.penalite_pct,
    annulation_membre_autorisee: annulation_membre_autorisee ?? current.annulation_membre_autorisee,
    remboursement_auto: remboursement_auto ?? current.remboursement_auto,
    message_membre: message_membre ?? current.message_membre,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('politique_annulation')
    .update(updates)
    .eq('id', current.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ policy: data });
});

// =========================================================================
// MODULE B — Sessions check-in / check-out (S3 Dev 1 — CDC B3)
// =========================================================================

app.get('/api/sessions', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { statut, from, to } = req.query;

  let query = supabaseAdmin
    .from('sessions')
    .select(`
      *,
      reservations (
        id, user_id, espace_id, date_debut, date_fin, statut,
        espaces (nom, type),
        profiles (nom, prenom, email)
      )
    `)
    .order('created_at', { ascending: false });

  if (statut) query = query.eq('statut', statut);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data });
});

app.get('/api/sessions/me', authenticate, async (req, res) => {
  const { data: reservations, error: resErr } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('user_id', req.user.id);

  if (resErr) return res.status(500).json({ error: resErr.message });

  const reservationIds = (reservations || []).map((r) => r.id);
  if (reservationIds.length === 0) {
    return res.json({ sessions: [], activeSession: null });
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select(`
      *,
      reservations (
        id, date_debut, date_fin, statut,
        espaces (nom, type)
      )
    `)
    .in('reservation_id', reservationIds)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const sessions = (data || []).map((session) => ({
    ...session,
    temps_restant: session.statut === 'active'
      ? computeRemainingMinutes(session.reservations?.date_fin)
      : session.temps_restant,
  }));

  const activeSession = sessions.find((s) => s.statut === 'active') || null;
  res.json({ sessions, activeSession });
});

app.get('/api/sessions/me/active', authenticate, async (req, res) => {
  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('user_id', req.user.id);

  const reservationIds = (reservations || []).map((r) => r.id);
  if (reservationIds.length === 0) {
    return res.json({ session: null });
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select(`
      *,
      reservations (
        id, date_debut, date_fin, statut,
        espaces (nom, type)
      )
    `)
    .in('reservation_id', reservationIds)
    .eq('statut', 'active')
    .order('check_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (!data) {
    return res.json({ session: null });
  }

  res.json({
    session: {
      ...data,
      temps_restant: computeRemainingMinutes(data.reservations?.date_fin),
    },
  });
});

app.post('/api/sessions/check-in', authenticate, async (req, res) => {
  const { reservation_id, qr_token, force } = req.body;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  try {
    let targetUserId = req.user.id;
    let reservation;

    if (qr_token && isStaff) {
      const { data: memberProfile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, nom, prenom, statut_compte')
        .eq('qr_token', qr_token)
        .single();

      if (profErr || !memberProfile) {
        return res.status(404).json({ error: 'QR code invalide ou expiré.' });
      }

      targetUserId = memberProfile.id;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayReservations } = await supabaseAdmin
        .from('reservations')
        .select('*, espaces(nom, type)')
        .eq('user_id', targetUserId)
        .eq('statut', 'confirmed')
        .gte('date_debut', todayStart.toISOString())
        .lte('date_debut', todayEnd.toISOString())
        .order('date_debut', { ascending: true })
        .limit(1);

      reservation = todayReservations?.[0];
      if (!reservation) {
        return res.status(404).json({
          error: 'Aucune réservation confirmée aujourd\'hui pour ce membre.',
          member: memberProfile,
        });
      }
    } else if (reservation_id) {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*, espaces(nom, type)')
        .eq('id', reservation_id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Réservation introuvable.' });
      }

      if (!isStaff && data.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Check-in non autorisé.' });
      }

      if (data.statut !== 'confirmed' && !isStaff) {
        return res.status(400).json({ error: 'Seules les réservations confirmées peuvent être check-in.' });
      }

      reservation = data;
      targetUserId = data.user_id;
    } else {
      return res.status(400).json({ error: 'reservation_id ou qr_token requis.' });
    }

    const hasSub = await hasActiveSubscription(targetUserId);
    if (!hasSub && !force && !isStaff) {
      return res.status(403).json({ error: 'Abonnement actif requis pour le check-in.' });
    }

    const remaining = computeRemainingMinutes(reservation.date_fin);
    const now = new Date().toISOString();

    const { data: existingSession } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('reservation_id', reservation.id)
      .maybeSingle();

    let session;
    if (existingSession) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .update({
          check_in: existingSession.check_in || now,
          statut: 'active',
          temps_restant: remaining,
        })
        .eq('id', existingSession.id)
        .select(`
          *,
          reservations (
            id, date_debut, date_fin, statut,
            espaces (nom, type),
            profiles (nom, prenom, email)
          )
        `)
        .single();

      if (error) return res.status(400).json({ error: error.message });
      session = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .insert({
          reservation_id: reservation.id,
          check_in: now,
          statut: 'active',
          temps_restant: remaining,
        })
        .select(`
          *,
          reservations (
            id, date_debut, date_fin, statut,
            espaces (nom, type),
            profiles (nom, prenom, email)
          )
        `)
        .single();

      if (error) return res.status(400).json({ error: error.message });
      session = data;
    }

    res.status(201).json({
      session: { ...session, temps_restant: remaining },
      warning: !hasSub ? 'Check-in effectué sans abonnement actif.' : null,
    });

    // ══ MODULE B+ : Événement temps réel ═══════════════════════════
    emitSessionStarted({
      id: session.id,
      user_id: targetUserId,
      reservation_id: reservation.id,
      check_in: session.check_in,
      temps_restant: remaining,
      espace: reservation.espaces,
    });
    // ═══════════════════════════════════════════════════════════════
  } catch (err) {
    console.error('Erreur check-in:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/check-out', authenticate, async (req, res) => {
  const { session_id, reservation_id } = req.body;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  if (!session_id && !reservation_id) {
    return res.status(400).json({ error: 'session_id ou reservation_id requis.' });
  }

  try {
    let query = supabaseAdmin
      .from('sessions')
      .select(`
        *,
        reservations (id, user_id, date_debut, date_fin, espaces(nom, type))
      `);

    if (session_id) query = query.eq('id', session_id);
    else query = query.eq('reservation_id', reservation_id);

    const { data: session, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !session) {
      return res.status(404).json({ error: 'Session introuvable.' });
    }

    if (!isStaff && session.reservations?.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Check-out non autorisé.' });
    }

    const now = new Date().toISOString();
    const endTime = new Date(session.reservations?.date_fin || now);
    const overtime = new Date(now) > endTime;

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({
        check_out: now,
        statut: overtime ? 'overtime' : 'completed',
        temps_restant: 0,
      })
      .eq('id', session.id)
      .select(`
        *,
        reservations (
          id, date_debut, date_fin, statut,
          espaces (nom, type)
        )
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      session: data,
      overtime,
      message: overtime ? 'Session terminée avec dépassement horaire.' : 'Check-out enregistré.',
    });

    // ══ MODULE B+ : Événement temps réel ═══════════════════════════
    const sessionEventData = {
      id: data.id,
      user_id: session.reservations?.user_id,
      reservation_id: session.reservation_id,
      check_out: data.check_out,
      statut: data.statut,
      espace: session.reservations?.espaces,
    };
    if (overtime) {
      emitSessionOvertime(sessionEventData);
    } else {
      emitSessionEnded(sessionEventData);
    }
    // ═══════════════════════════════════════════════════════════════
  } catch (err) {
    console.error('Erreur check-out:', err);
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
// MODULE C — Intégration Paiement Stripe
// =========================================================================

// POST /api/stripe/pay — Créer une session Stripe Checkout
app.post('/api/stripe/pay', authenticate, async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'paymentId requis' });

  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        error: 'Stripe non configuré. Ajoutez STRIPE_SECRET_KEY dans .env.',
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

    const session = await createCheckoutSession(payment, req.user.id);

    if (session.id) {
      await supabaseAdmin
        .from('paiements')
        .update({ reference_externe: session.id })
        .eq('id', paymentId);
    }

    res.json({ link: session.url, session_id: session.id });
  } catch (err) {
    console.error('Erreur Stripe Pay:', err.message);
    res.status(500).json({ error: err.message || 'Impossible de contacter Stripe.' });
  }
});

// POST /api/stripe/verify — Vérifier le paiement après retour Stripe Checkout
app.post('/api/stripe/verify', authenticate, async (req, res) => {
  const { paymentId, session_id: sessionId } = req.body;
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

    const stripeSessionId = sessionId || payment.reference_externe;
    if (!stripeSessionId) {
      return res.status(400).json({ error: 'Référence session Stripe manquante.' });
    }

    const session = await retrieveCheckoutSession(stripeSessionId);
    validateCheckoutSession(session, paymentId, req.user.id);

    if (isCheckoutSessionPaid(session)) {
      const updatedPayment = await finalizeOnlinePayment(
        supabaseAdmin,
        paymentId,
        req.user.id,
        getExternalReference(session)
      );
      return res.json({ success: true, payment: updatedPayment });
    }

    res.json({ success: false, message: "Le paiement n'a pas été validé par Stripe." });
  } catch (err) {
    console.error('Erreur Stripe Verify:', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la vérification Stripe' });
  }
});

// Démarrage des tâches planifiées (Cron)
startPaymentRemindersCron(supabaseAdmin);
startReservationRemindersCron(supabaseAdmin);
startSubscriptionRemindersCron(supabaseAdmin);

// Socket.io (Module B+ — Sessions temps réel)
const http = require('http');
const server = http.createServer(app);
initSocket(server, supabaseUrl, supabaseServiceKey);

server.listen(PORT, () => {
  console.log(`API Dev 1 + Dev 2 démarrée sur http://localhost:${PORT}`);
  console.log('✅ Module F - Notifications automatiques activées.');
  console.log('✅ Module B+ - Socket.io temps réel activé.');
});
