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
const { startFormationRemindersCron } = require('./cron/formationReminders');
const { initSocket, emitSessionStarted, emitSessionEnded, emitSessionOvertime } = require('./services/socketService');
const createModulesHJKLNRouter = require('./routes/modulesHJKLN');
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

async function findActiveTarif(typeAbonnement, planTarifaire, tenantId) {
  const today = todayISO();
  let q = supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .eq('type_abonnement', typeAbonnement)
    .eq('plan_tarifaire', planTarifaire)
    .eq('actif', true)
    .lte('date_debut', today);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q.order('date_debut', { ascending: false });

  if (error) throw error;
  const tarif = (data || []).find((t) => !t.date_fin || t.date_fin >= today);
  return tarif || null;
}

async function findValidPromoCode(code, tenantId) {
  const today = todayISO();
  let q = supabaseAdmin
    .from('codes_promo')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('actif', true);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q.single();

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

async function getCancellationPolicy(tenantId) {
  let q = supabaseAdmin
    .from('politique_annulation')
    .select('*');
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q.order('updated_at', { ascending: false })
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
    if (profile.statut_compte === 'en_attente') {
      return res.status(403).json({ error: 'Compte en attente d\'approbation. L\'administrateur doit valider votre inscription.', code: 'PENDING_APPROVAL' });
    }
    return res.status(403).json({ error: 'Compte suspendu ou expiré. Contactez l\'administrateur.' });
  }

  req.user = data.user;
  req.profile = profile;
  req.token = token;
  req.db = getUserClient(token);
  req.tenantId = profile.tenant_id || null;
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

// =========================================================================
// MULTI-TENANT MIDDLEWARE (S6 — VCLOW SaaS)
// =========================================================================

function requireSuperAdmin(req, res, next) {
  if (req.profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Réservé au Super Admin (VCLOW).' });
  }
  next();
}

function applyTenantFilter(query, req, tenantIdField = 'tenant_id') {
  if (req.profile.role !== 'super_admin' && req.tenantId) {
    return query.eq(tenantIdField, req.tenantId);
  }
  return query;
}

async function auditLog(supabase, userId, action, targetType, targetId, targetName, details, ipAddress, status = 'success') {
  try {
    await supabase.from('super_admin_audit_log').insert({
      user_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      details: details || {},
      ip_address: ipAddress || null,
      status,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// =========================================================================
// SUPER ADMIN — Tenant Management (S6 — VCLOW SaaS)
// =========================================================================

// GET /api/super-admin/tenants — Liste tous les coworkings
app.get('/api/super-admin/tenants', authenticate, requireSuperAdmin, async (req, res) => {
  const { page = 1, limit = 20, statut, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (statut) query = query.eq('statut', statut);
  if (search) query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });

  const enriched = await Promise.all((data || []).map(async (t) => {
    const { count: memberCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .in('role', ['member', 'guest']);

    const { count: spaceCount } = await supabaseAdmin
      .from('espaces')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', t.id);

    return { ...t, member_count: memberCount || 0, space_count: spaceCount || 0 };
  }));

  res.json({ tenants: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
});

// GET /api/super-admin/tenants/:id — Détail d'un tenant
app.get('/api/super-admin/tenants/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const [{ count: memberCount }, { count: spaceCount }, { count: bookingCount }, { count: subCount }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).in('role', ['member', 'guest']),
    supabaseAdmin.from('espaces').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    supabaseAdmin.from('abonnements').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('statut', 'active'),
  ]);

  res.json({
    tenant: {
      ...tenant,
      stats: { members: memberCount || 0, spaces: spaceCount || 0, bookings: bookingCount || 0, activeSubscriptions: subCount || 0 },
    },
  });
});

// POST /api/super-admin/tenants — Créer un coworking
app.post('/api/super-admin/tenants', authenticate, requireSuperAdmin, async (req, res) => {
  const { nom, slug, description, adresse, ville, pays, email, telephone, site_web, plan, tier, montant_mensuel, limite_membres, limite_espaces } = req.body;

  if (!nom) return res.status(400).json({ error: 'Le nom du coworking est requis.' });

  const tenantSlug = slug || nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .insert({
      nom,
      slug: tenantSlug,
      description: description || null,
      adresse: adresse || null,
      ville: ville || null,
      pays: pays || 'Tunisie',
      email: email || null,
      telephone: telephone || null,
      site_web: site_web || null,
      plan: plan || 'starter',
      tier: tier || 'C',
      montant_mensuel: montant_mensuel || 0,
      limite_membres: limite_membres || 100,
      limite_espaces: limite_espaces || 10,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await auditLog(supabaseAdmin, req.user.id, 'tenant_created', 'tenant', data.id, data.nom, { plan: data.plan, tier: data.tier }, req.ip);
  res.status(201).json({ tenant: data });
});

// PATCH /api/super-admin/tenants/:id — Modifier un coworking
app.patch('/api/super-admin/tenants/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const allowed = ['nom', 'description', 'adresse', 'ville', 'pays', 'email', 'telephone', 'site_web', 'logo_url', 'statut', 'plan', 'tier', 'montant_mensuel', 'derniere_facture', 'prochaine_echeance', 'limite_membres', 'limite_espaces', 'settings'];
  const updates = { updated_at: new Date().toISOString() };

  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Si le statut du tenant change, synchroniser le statut du compte admin associé
  if (updates.statut !== undefined) {
    const nextProfileStatut = updates.statut === 'actif' ? 'actif' : 'suspendu';
    await supabaseAdmin
      .from('profiles')
      .update({ statut_compte: nextProfileStatut, updated_at: new Date().toISOString() })
      .eq('tenant_id', req.params.id)
      .eq('role', 'admin');
  }

  await auditLog(supabaseAdmin, req.user.id, 'tenant_updated', 'tenant', data.id, data.nom, { fields: Object.keys(updates) }, req.ip);
  res.json({ tenant: data });

});

// DELETE /api/super-admin/tenants/:id — Supprimer un coworking
app.delete('/api/super-admin/tenants/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const { data: tenant, error: fetchErr } = await supabaseAdmin
    .from('tenants')
    .select('id, nom')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const { error } = await supabaseAdmin.from('tenants').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  await auditLog(supabaseAdmin, req.user.id, 'tenant_deleted', 'tenant', tenant.id, tenant.nom, {}, req.ip);
  res.json({ message: `Coworking "${tenant.nom}" supprimé.` });
});

// POST /api/super-admin/tenants/:id/onboard — Onboard admin pour un coworking
app.post('/api/super-admin/tenants/:id/onboard', authenticate, requireSuperAdmin, async (req, res) => {
  const { email, nom, prenom, telephone } = req.body;
  if (!email) return res.status(400).json({ error: 'Email de l\'admin requis.' });

  const { data: tenant, error: tErr } = await supabaseAdmin.from('tenants').select('*').eq('id', req.params.id).single();
  if (tErr || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { role: 'admin', tenant_id: tenant.id, nom: nom || tenant.nom, prenom: prenom || 'Admin', telephone: telephone || '' },
    redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
  });

  if (authErr) return res.status(400).json({ error: authErr.message });

  await supabaseAdmin.from('tenants').update({ contact_admin_id: authUser.user.id }).eq('id', tenant.id);
  await auditLog(supabaseAdmin, req.user.id, 'tenant_onboarded', 'tenant', tenant.id, tenant.nom, { admin_email: email }, req.ip);

  res.json({ message: `Invitation envoyée à ${email} pour gérer "${tenant.nom}".`, user: { id: authUser.user.id, email } });
});

// GET /api/super-admin/stats — Statistiques globales
app.get('/api/super-admin/stats', authenticate, requireSuperAdmin, async (_req, res) => {
  const [{ count: totalTenants }, { count: activeTenants }, { count: suspendedTenants }, { count: totalMembers }] = await Promise.all([
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'suspendu'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['member', 'guest']),
  ]);

  const { data: tenants } = await supabaseAdmin.from('tenants').select('montant_mensuel, statut');
  const mrr = (tenants || []).filter(t => t.statut === 'actif').reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);

  res.json({
    totalTenants: totalTenants || 0,
    activeTenants: activeTenants || 0,
    suspendedTenants: suspendedTenants || 0,
    totalMembers: totalMembers || 0,
    mrr,
  });
});

// GET /api/super-admin/audit — Journal d'audit
app.get('/api/super-admin/audit', authenticate, requireSuperAdmin, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error, count } = await supabaseAdmin
    .from('super_admin_audit_log')
    .select('*, profiles!user_id(nom, prenom)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ logs: data || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
});

app.get('/', (_req, res) => {
  res.json({
    message: 'VC LOW Coworking API — Multi-Tenant SaaS',
    modules: [
      'A — Membres & Abonnements (Dev 1)',
      'B — Réservations & Disponibilité (Dev 1)',
      'C — Paiements & Encaissements (Dev 2)',
      'S6 — Multi-Tenant (VCLOW Platform)',
    ],
    version: '2.0.0 (S6 Multi-Tenant)',
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
    if (!['actif', 'suspendu', 'expire', 'en_attente'].includes(statut_compte)) {
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

// GET /api/admin/pending-accounts — Comptes en attente d'approbation
app.get('/api/admin/pending-accounts', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email, role, telephone, specialite, biographie, type_membre, statut_compte, created_at')
    .eq('statut_compte', 'en_attente')
    .order('created_at', { ascending: true });

  query = applyTenantFilter(query, req);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ pending: data || [] });
});

// PATCH /api/admin/approve-account/:id — Approuver ou rejeter un compte
app.patch('/api/admin/approve-account/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action doit être "approve" ou "reject".' });
  }

  const newStatut = action === 'approve' ? 'actif' : 'suspendu';

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ statut_compte: newStatut, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id, nom, prenom, email, role, statut_compte')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({
    profile: data,
    message: action === 'approve'
      ? `Compte de ${data.prenom} ${data.nom} approuvé avec succès.`
      : `Compte de ${data.prenom} ${data.nom} rejeté.`,
  });
});

app.get('/api/members', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  let query = supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  query = applyTenantFilter(query, req);

  const { data, error } = await query;
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
    const tarif = await findActiveTarif(type, plan, req.tenantId);
    if (tarif) {
      tarifInfo = tarif;
      if (code_promo) {
        promoInfo = await findValidPromoCode(code_promo, req.tenantId);
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
      tenant_id: req.tenantId,
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

// POST /api/subscriptions/self — Le membre souscrit lui-même un abonnement
app.post('/api/subscriptions/self', authenticate, async (req, res) => {
  const { type, code_promo, renouvellement_auto } = req.body;
  const userId = req.user.id;

  if (!type) {
    return res.status(400).json({ error: 'Le type d\'abonnement est requis.' });
  }

  if (!SUBSCRIPTION_DURATIONS[type] && type !== 'bureau_prive') {
    return res.status(400).json({ error: 'Type d\'abonnement invalide.' });
  }

  // Vérifier si le membre a déjà un abonnement actif
  const today = todayISO();
  const { data: existing } = await supabaseAdmin
    .from('abonnements')
    .select('id, type, date_fin')
    .eq('user_id', userId)
    .eq('statut', 'active')
    .gte('date_fin', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: 'Vous avez déjà un abonnement actif. Il expire le ' + existing[0].date_fin + '.' });
  }

  const date_debut = today;
  let date_fin;
  if (type === 'bureau_prive') {
    return res.status(400).json({ error: 'Le bureau privé doit être configuré par un admin.' });
  }
  date_fin = addDays(date_debut, SUBSCRIPTION_DURATIONS[type] - 1);

  // Lookup plan tarifaire du membre
  const { data: memberProfile } = await supabaseAdmin
    .from('profiles').select('type_membre').eq('id', userId).single();

  const plan = MEMBER_TYPE_TO_PLAN[memberProfile?.type_membre] || 'standard';
  let tarifInfo = null;
  let promoInfo = null;

  try {
    tarifInfo = await findActiveTarif(type, plan, req.tenantId);
    if (code_promo && tarifInfo) {
      promoInfo = await findValidPromoCode(code_promo, req.tenantId);
      if (!promoInfo) {
        return res.status(400).json({ error: 'Code promo invalide ou expiré.' });
      }
    }
  } catch (e) {
    console.warn('Tarification non disponible:', e.message);
  }

  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .insert({
      user_id: userId,
      type,
      date_debut,
      date_fin,
      renouvellement_auto: Boolean(renouvellement_auto),
      statut: 'active',
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

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
      user_id: userId,
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

  // Notifier le staff
  const { emitToStaff } = require('./services/socketService');
  emitToStaff('subscription:created', { user_id: userId, type, plan, pricing: pricingResult });

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

app.get('/api/subscriptions', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  let query = supabaseAdmin
    .from('abonnements')
    .select('*, profiles(nom, prenom, email)')
    .order('created_at', { ascending: false });
  query = applyTenantFilter(query, req);
  const { data, error } = await query;

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

  let q = supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .eq('plan_tarifaire', plan)
    .eq('actif', true)
    .lte('date_debut', today);
  if (req.tenantId) q = q.eq('tenant_id', req.tenantId);
  const { data, error } = await q
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

app.get('/api/pricing/all', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  let query = supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .order('type_abonnement', { ascending: true });
  query = applyTenantFilter(query, req);
  const { data, error } = await query;

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
      tenant_id: req.tenantId,
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
    const promo = await findValidPromoCode(code, req.tenantId);
    if (!promo) {
      return res.status(404).json({ valid: false, error: 'Code promo invalide ou expiré.' });
    }

    const tarif = await findActiveTarif(type_abonnement, plan, req.tenantId);
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

app.get('/api/promo-codes', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  let query = supabaseAdmin
    .from('codes_promo')
    .select('*')
    .order('created_at', { ascending: false });
  query = applyTenantFilter(query, req);
  const { data, error } = await query;

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
      tenant_id: req.tenantId,
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

app.get('/api/espaces', authenticate, async (req, res) => {
  let query = supabaseAdmin
    .from('espaces')
    .select('*')
    .order('tarif_horaire', { ascending: true });

  query = applyTenantFilter(query, req);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ espaces: data });
});

// =========================================================================
// ADMIN — Configuration du coworking (onboarding + gestion espaces)
// =========================================================================

app.get('/api/admin/tenant', authenticate, requireRoles('admin', 'staff'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', req.tenantId)
    .single();

  if (error || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const { count: spaceCount } = await supabaseAdmin
    .from('espaces')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenantId);

  res.json({
    tenant,
    space_count: spaceCount || 0,
    onboarding_completed: tenant.settings?.onboarding_completed === true,
  });
});

app.patch('/api/admin/tenant', authenticate, requireRoles('admin'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const allowed = ['description', 'adresse', 'ville', 'pays', 'email', 'telephone', 'site_web', 'logo_url'];
  const updates = { updated_at: new Date().toISOString() };

  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(updates)
    .eq('id', req.tenantId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ tenant: data });
});

app.post('/api/admin/espaces', authenticate, requireRoles('admin'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const { nom, type, capacite, tarif_horaire } = req.body;
  if (!nom || !type || !capacite) {
    return res.status(400).json({ error: 'Nom, type et capacité sont requis.' });
  }

  const validTypes = ['open_space', 'private_office', 'meeting_room', 'training_room', 'event_space'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type d\'espace invalide.' });
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('limite_espaces')
    .eq('id', req.tenantId)
    .single();

  const { count: currentCount } = await supabaseAdmin
    .from('espaces')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenantId);

  if (currentCount >= (tenant?.limite_espaces || 10)) {
    return res.status(400).json({ error: 'Limite d\'espaces atteinte pour votre plan.' });
  }

  const { data, error } = await supabaseAdmin
    .from('espaces')
    .insert({
      nom,
      type,
      capacite: parseInt(capacite, 10),
      tarif_horaire: parseFloat(tarif_horaire) || 0,
      tenant_id: req.tenantId,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ espace: data });
});

app.patch('/api/admin/espaces/:id', authenticate, requireRoles('admin'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('espaces')
    .select('id')
    .eq('id', req.params.id)
    .eq('tenant_id', req.tenantId)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Espace introuvable.' });

  const allowed = ['nom', 'type', 'capacite', 'tarif_horaire'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });

  const { data, error } = await supabaseAdmin
    .from('espaces')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ espace: data });
});

app.delete('/api/admin/espaces/:id', authenticate, requireRoles('admin'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('espaces')
    .select('id, nom')
    .eq('id', req.params.id)
    .eq('tenant_id', req.tenantId)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Espace introuvable.' });

  const { error } = await supabaseAdmin.from('espaces').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `Espace "${existing.nom}" supprimé.` });
});

app.post('/api/admin/onboarding/complete', authenticate, requireRoles('admin'), async (req, res) => {
  if (!req.tenantId) return res.status(404).json({ error: 'Aucun coworking associé à votre compte.' });

  const { count: spaceCount } = await supabaseAdmin
    .from('espaces')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenantId);

  if (!spaceCount || spaceCount < 1) {
    return res.status(400).json({ error: 'Ajoutez au moins un espace avant de terminer la configuration.' });
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', req.tenantId)
    .single();

  const settings = { ...(tenant?.settings || {}), onboarding_completed: true };

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', req.tenantId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ tenant: data, message: 'Configuration terminée avec succès.' });
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

  query = applyTenantFilter(query, req);

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
      tenant_id: req.tenantId,
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

    const policy = await getCancellationPolicy(req.tenantId);
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

app.get('/api/settings/cancellation-policy', authenticate, async (req, res) => {
  const policy = await getCancellationPolicy(req.tenantId);
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

  const current = await getCancellationPolicy(req.tenantId);
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
  query = applyTenantFilter(query, req);

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
    tenant_id: req.tenantId,
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

// POST /api/payments/self — Créer un paiement pour sa propre réservation (utilisateurs authentifiés)
app.post('/api/payments/self', authenticate, async (req, res) => {
  const { reservation_id, abonnement_id, montant, mode, statut } = req.body;
  const userId = req.user.id;

  // Validation des champs requis
  if (!montant || !mode) {
    return res.status(400).json({ error: 'montant et mode sont requis.' });
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

  // Vérifier que la réservation existe et appartient à l'utilisateur
  if (reservation_id) {
    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('id, user_id, tenant_id')
      .eq('id', reservation_id)
      .single();

    if (resError || !reservation) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    // Vérifier que la réservation appartient à l'utilisateur
    if (reservation.user_id !== userId) {
      return res.status(403).json({ error: 'Vous ne pouvez créer un paiement que pour vos propres réservations.' });
    }

    // Récupérer le tenant_id depuis la réservation
    req.tenantId = reservation.tenant_id;
  }

  // Vérifier que l'abonnement existe et appartient à l'utilisateur
  if (abonnement_id) {
    const { data: abonnement, error: abError } = await supabaseAdmin
      .from('abonnements')
      .select('id, user_id, tenant_id')
      .eq('id', abonnement_id)
      .single();

    if (abError || !abonnement) {
      return res.status(404).json({ error: 'Abonnement introuvable.' });
    }

    // Vérifier que l'abonnement appartient à l'utilisateur
    if (abonnement.user_id !== userId) {
      return res.status(403).json({ error: 'Vous ne pouvez créer un paiement que pour vos propres abonnements.' });
    }

    // Récupérer le tenant_id depuis l'abonnement
    req.tenantId = abonnement.tenant_id;
  }

  // Créer le paiement
  const paymentData = {
    user_id: userId,
    reservation_id: reservation_id || null,
    abonnement_id: abonnement_id || null,
    montant: parseFloat(montant),
    mode,
    statut: statut || 'pending',
    tenant_id: req.tenantId,
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

    query = applyTenantFilter(query, req);

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
        abonnements(type, date_debut, date_fin),
        inscriptions_formations ( formations (id, titre) )
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
    let query = supabaseAdmin
      .from('paiements')
      .select(`
        *,
        profiles(nom, prenom, email, telephone),
        reservations(date_debut, date_fin, espaces(nom)),
        abonnements(type, date_debut, date_fin)
      `)
      .eq('statut', 'pending')
      .order('created_at', { ascending: true });
    query = applyTenantFilter(query, req);
    const { data, error } = await query;

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
      .select(`*, inscriptions_formations ( formations (titre) )`)
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

// =========================================================================
// MODULE D — KPIs & Dashboard Admin (Dev 2 — S4)
// =========================================================================

// GET /api/admin/kpis — Tous les KPIs du dashboard en un seul appel
app.get('/api/admin/kpis', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tid = req.tenantId;

    // Début du mois et début de l'année
    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const debutMoisPrecedent = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const finMoisPrecedent = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString();
    const debutAnnee = new Date(today.getFullYear(), 0, 1).toISOString();
    const debutJour = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const finJour = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    // ── 1. Membres actifs ──────────────────────────────────────────────
    let membQ = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('statut_compte', 'actif')
      .eq('role', 'member');
    if (tid) membQ = membQ.eq('tenant_id', tid);
    const { count: membresActifs } = await membQ;

    // ── 2. Nouveaux membres ce mois vs mois précédent ──────────────────
    let nmQ = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', debutMois);
    if (tid) nmQ = nmQ.eq('tenant_id', tid);
    const { count: nouveauxMoisActuel } = await nmQ;

    let nmpQ = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', debutMoisPrecedent)
      .lte('created_at', finMoisPrecedent);
    if (tid) nmpQ = nmpQ.eq('tenant_id', tid);
    const { count: nouveauxMoisPrecedent } = await nmpQ;

    const evolutionMembres = nouveauxMoisPrecedent > 0
      ? Math.round(((nouveauxMoisActuel - nouveauxMoisPrecedent) / nouveauxMoisPrecedent) * 100)
      : nouveauxMoisActuel > 0 ? 100 : 0;

    // ── 3. Chiffre d'affaires ──────────────────────────────────────────
    let pjQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutJour).lte('date_paiement', finJour);
    if (tid) pjQ = pjQ.eq('tenant_id', tid);
    const { data: paieJour } = await pjQ;

    let pmQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutMois);
    if (tid) pmQ = pmQ.eq('tenant_id', tid);
    const { data: paieMois } = await pmQ;

    let paQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutAnnee);
    if (tid) paQ = paQ.eq('tenant_id', tid);
    const { data: paieAnnee } = await paQ;

    const caJour = (paieJour || []).reduce((s, p) => s + parseFloat(p.montant || 0), 0);
    const caMois = (paieMois || []).reduce((s, p) => s + parseFloat(p.montant || 0), 0);
    const caAnnee = (paieAnnee || []).reduce((s, p) => s + parseFloat(p.montant || 0), 0);

    // ── 4. Taux d'occupation des espaces ──────────────────────────────
    let espQ = supabaseAdmin.from('espaces').select('id, nom, type');
    if (tid) espQ = espQ.eq('tenant_id', tid);
    const { data: espaces } = await espQ;

    let resvQ = supabaseAdmin.from('reservations').select('espace_id, date_debut, date_fin').in('statut', ['confirmed', 'pending']).gte('date_debut', debutMois);
    if (tid) resvQ = resvQ.eq('tenant_id', tid);
    const { data: reservationsMois } = await resvQ;

    const periodMs = Date.now() - new Date(debutMois).getTime();
    const tauxOccupation = (espaces || []).map((espace) => {
      const resEspace = (reservationsMois || []).filter((r) => r.espace_id === espace.id);
      const reservedMs = resEspace.reduce((acc, r) => {
        return acc + (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime());
      }, 0);
      const taux = periodMs > 0 ? Math.min(100, Math.round((reservedMs / periodMs) * 100)) : 0;
      return { nom: espace.nom, type: espace.type, taux };
    });

    // ── 5. Sessions en cours (actives) ────────────────────────────────
    let sessQ = supabaseAdmin
      .from('sessions')
      .select(`
        id, check_in, temps_restant, statut,
        reservations (
          date_debut, date_fin,
          espaces (nom, type),
          profiles (nom, prenom)
        )
      `)
      .eq('statut', 'active');
    if (tid) sessQ = sessQ.eq('tenant_id', tid);
    const { data: sessionsActives } = await sessQ;

    const sessionsEnCours = (sessionsActives || []).map((s) => ({
      id: s.id,
      membre: s.reservations?.profiles
        ? `${s.reservations.profiles.prenom} ${s.reservations.profiles.nom}`
        : 'Inconnu',
      espace: s.reservations?.espaces?.nom || 'Inconnu',
      check_in: s.check_in,
      tempsRestant: computeRemainingMinutes(s.reservations?.date_fin),
      dateFin: s.reservations?.date_fin,
    }));

    // ── 6. Paiements en attente ────────────────────────────────────────
    let peaQ = supabaseAdmin.from('paiements').select('montant, created_at').eq('statut', 'pending');
    if (tid) peaQ = peaQ.eq('tenant_id', tid);
    const { data: paiementsEnAttente } = await peaQ;

    const montantEnAttente = (paiementsEnAttente || [])
      .reduce((s, p) => s + parseFloat(p.montant || 0), 0);

    // ── 7. Abonnements expirant dans 7 jours ──────────────────────────
    const dans7Jours = new Date();
    dans7Jours.setDate(dans7Jours.getDate() + 7);
    const dans7JoursStr = dans7Jours.toISOString().split('T')[0];

    let abExpQ = supabaseAdmin
      .from('abonnements')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'active')
      .gte('date_fin', todayStr)
      .lte('date_fin', dans7JoursStr);
    if (tid) abExpQ = abExpQ.eq('tenant_id', tid);
    const { count: abonnementsExpirant } = await abExpQ;

    // ── 8. Réservations du jour ───────────────────────────────────────
    const debutJourStr = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    const finJourStr = new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

    let resvJQ = supabaseAdmin
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', debutJourStr)
      .lte('date_debut', finJourStr);
    if (tid) resvJQ = resvJQ.eq('tenant_id', tid);
    const { count: reservationsDuJour } = await resvJQ;

    // ── 9. Formations du jour ─────────────────────────────────────────
    let formationsDuJour = 0;
    try {
      let fdjQ = supabaseAdmin
        .from('formations')
        .select('*', { count: 'exact', head: true })
        .in('statut', ['planifiee', 'en_cours'])
        .gte('date_debut', debutJourStr)
        .lte('date_debut', finJourStr);
      if (tid) fdjQ = fdjQ.eq('tenant_id', tid);
      const { count: fdj } = await fdjQ;
      formationsDuJour = fdj || 0;
    } catch (_) {
      formationsDuJour = 0;
    }

    // ── 10. Top membres (par CA généré) ──────────────────────────────
    let topPQ = supabaseAdmin
      .from('paiements')
      .select('user_id, montant, profiles(nom, prenom, email)')
      .eq('statut', 'paid')
      .gte('date_paiement', debutAnnee);
    if (tid) topPQ = topPQ.eq('tenant_id', tid);
    const { data: topPaiements } = await topPQ;

    const topMembresMap = {};
    (topPaiements || []).forEach((p) => {
      if (!p.user_id) return;
      if (!topMembresMap[p.user_id]) {
        topMembresMap[p.user_id] = {
          nom: p.profiles ? `${p.profiles.prenom} ${p.profiles.nom}` : 'Inconnu',
          email: p.profiles?.email || '',
          ca: 0,
        };
      }
      topMembresMap[p.user_id].ca += parseFloat(p.montant || 0);
    });

    const topMembres = Object.values(topMembresMap)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);

    res.json({
      membresActifs: membresActifs || 0,
      nouveauxMembres: {
        moisActuel: nouveauxMoisActuel || 0,
        moisPrecedent: nouveauxMoisPrecedent || 0,
        evolution: evolutionMembres,
      },
      chiffreAffaires: {
        jour: Math.round(caJour * 100) / 100,
        mois: Math.round(caMois * 100) / 100,
        annee: Math.round(caAnnee * 100) / 100,
      },
      tauxOccupation,
      sessionsEnCours,
      paiementsEnAttente: {
        count: (paiementsEnAttente || []).length,
        montantTotal: Math.round(montantEnAttente * 100) / 100,
      },
      abonnementsExpirant: abonnementsExpirant || 0,
      reservationsDuJour: reservationsDuJour || 0,
      formationsDuJour,
      topMembres,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur KPIs:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/kpis/revenue-chart — Évolution CA sur les 6 derniers mois
app.get('/api/admin/kpis/revenue-chart', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    const tid = req.tenantId;

    // Construire les 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        debut: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        fin: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      });
    }

    let paieQ = supabaseAdmin
      .from('paiements')
      .select('montant, date_paiement')
      .eq('statut', 'paid')
      .gte('date_paiement', months[0].debut)
      .lte('date_paiement', months[months.length - 1].fin);
    if (tid) paieQ = paieQ.eq('tenant_id', tid);
    const { data: paiements } = await paieQ;

    // Agréger par mois
    const chart = months.map((m) => {
      const moisPaiements = (paiements || []).filter((p) => {
        if (!p.date_paiement) return false;
        const d = new Date(p.date_paiement);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const ca = moisPaiements.reduce((s, p) => s + parseFloat(p.montant || 0), 0);
      return {
        mois: m.label,
        ca: Math.round(ca * 100) / 100,
        transactions: moisPaiements.length,
      };
    });

    // Récupérer les données d'occupation pour les 6 mois (moyenne mensuelle)
    let resvAllQ = supabaseAdmin
      .from('reservations')
      .select('espace_id, date_debut, date_fin, statut')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', months[0].debut)
      .lte('date_debut', months[months.length - 1].fin);
    if (tid) resvAllQ = resvAllQ.eq('tenant_id', tid);
    const { data: reservationsAll } = await resvAllQ;

    let espChartQ = supabaseAdmin.from('espaces').select('id, nom');
    if (tid) espChartQ = espChartQ.eq('tenant_id', tid);
    const { data: espaces } = await espChartQ;

    const occupationChart = months.map((m) => {
      const moisRes = (reservationsAll || []).filter((r) => {
        const d = new Date(r.date_debut);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const periodMs = new Date(m.fin).getTime() - new Date(m.debut).getTime();
      const tauxMoyen = (espaces || []).length > 0
        ? Math.round(
          (espaces || []).reduce((acc, esp) => {
            const espRes = moisRes.filter((r) => r.espace_id === esp.id);
            const ms = espRes.reduce((s, r) =>
              s + (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime()), 0);
            return acc + (periodMs > 0 ? Math.min(100, (ms / periodMs) * 100) : 0);
          }, 0) / (espaces || []).length
        )
        : 0;

      return { mois: m.label, taux: tauxMoyen };
    });

    res.json({ revenueChart: chart, occupationChart });
  } catch (err) {
    console.error('Erreur revenue-chart:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// MODULE G — FORMATEURS (Dev 2 — S5)
// =========================================================================

// GET /api/formateurs — Liste tous les formateurs
app.get('/api/formateurs', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  let query = supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email, telephone, specialite, biographie, statut_compte, created_at')
    .eq('role', 'formateur')
    .order('nom', { ascending: true });

  if (!isStaff) query = query.eq('statut_compte', 'actif');
  query = applyTenantFilter(query, req);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ formateurs: data });
});

// GET /api/formateurs/:id — Profil d'un formateur avec ses formations
app.get('/api/formateurs/:id', authenticate, async (req, res) => {
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email, telephone, specialite, biographie, statut_compte, created_at')
    .eq('id', req.params.id)
    .eq('role', 'formateur')
    .single();

  if (profErr || !profile) return res.status(404).json({ error: 'Formateur introuvable.' });

  const { data: formations } = await supabaseAdmin
    .from('formations')
    .select('id, titre, date_debut, date_fin, statut, capacite_max, prix_inscription')
    .eq('formateur_id', req.params.id)
    .order('date_debut', { ascending: false });

  const { data: remuneration } = await supabaseAdmin
    .from('remuneration_formateurs')
    .select('id, montant, statut, date_versement, formations(titre)')
    .eq('formateur_id', req.params.id);

  res.json({ formateur: profile, formations: formations || [], remuneration: remuneration || [] });
});

// POST /api/formateurs — Créer un profil formateur (admin uniquement)
app.post('/api/formateurs', authenticate, requireRoles('super_admin', 'admin'), async (req, res) => {
  const { nom, prenom, email, telephone, specialite, biographie } = req.body;
  if (!nom || !prenom || !email) {
    return res.status(400).json({ error: 'nom, prenom et email sont requis.' });
  }

  const temporaryPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';

  // Créer l'utilisateur via Supabase Auth
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { nom, prenom, role: 'formateur', telephone: telephone || '' },
  });
  if (authErr) return res.status(400).json({ error: authErr.message });

  // Mettre à jour le profil avec les infos formateur
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .update({ nom, prenom, telephone: telephone || '', specialite: specialite || '', biographie: biographie || '', tenant_id: req.tenantId, updated_at: new Date().toISOString() })
    .eq('id', authData.user.id)
    .select()
    .single();

  if (profErr) return res.status(400).json({ error: profErr.message });

  res.status(201).json({ formateur: profile });
});

// PATCH /api/formateurs/:id — Mettre à jour un formateur
app.patch('/api/formateurs/:id', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const allowed = ['nom', 'prenom', 'telephone', 'specialite', 'biographie', 'statut_compte'];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.params.id)
    .eq('role', 'formateur')
    .select('id, nom, prenom, email, telephone, specialite, biographie, statut_compte')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ formateur: data });
});

// POST /api/formateurs/:id/remuneration — Enregistrer rémunération
app.post('/api/formateurs/:id/remuneration', authenticate, requireRoles('super_admin', 'admin'), async (req, res) => {
  const { formation_id, montant, statut, date_versement, note } = req.body;
  if (!formation_id || montant == null) return res.status(400).json({ error: 'formation_id et montant requis.' });

  const { data, error } = await supabaseAdmin
    .from('remuneration_formateurs')
    .upsert({ formateur_id: req.params.id, formation_id, montant: parseFloat(montant), statut: statut || 'en_attente', date_versement: date_versement || null, note: note || null }, { onConflict: 'formateur_id,formation_id' })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ remuneration: data });
});

// =========================================================================
// MODULE G — FORMATIONS (Dev 2 — S5)
// =========================================================================

// GET /api/formations — Catalogue des formations (filtrable)
app.get('/api/formations', authenticate, async (req, res) => {
  const { statut, formateur_id, from, to } = req.query;
  let query = supabaseAdmin
    .from('formations')
    .select(`
      *,
      profiles!formateur_id (id, nom, prenom, specialite),
      espaces (id, nom, type),
      inscriptions_formations (count)
    `)
    .order('date_debut', { ascending: true });

  if (statut) query = query.eq('statut', statut);
  if (formateur_id) query = query.eq('formateur_id', formateur_id);
  if (from) query = query.gte('date_debut', from);
  if (to) query = query.lte('date_debut', to);
  query = applyTenantFilter(query, req);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Calculer le nombre d'inscrits pour chaque formation
  const formatted = await Promise.all((data || []).map(async (f) => {
    const { count } = await supabaseAdmin
      .from('inscriptions_formations')
      .select('*', { count: 'exact', head: true })
      .eq('formation_id', f.id)
      .neq('statut', 'annulee');
    return { ...f, nb_inscrits: count || 0, places_restantes: f.capacite_max - (count || 0) };
  }));

  res.json({ formations: formatted });
});

// GET /api/formations/:id — Détail d'une formation
app.get('/api/formations/:id', authenticate, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('formations')
    .select(`*, profiles!formateur_id (id, nom, prenom, email, specialite, biographie), espaces (id, nom, type, capacite)`)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Formation introuvable.' });

  const { data: inscrits, count } = await supabaseAdmin
    .from('inscriptions_formations')
    .select('*, profiles!user_id (id, nom, prenom, email, telephone)', { count: 'exact' })
    .eq('formation_id', req.params.id)
    .neq('statut', 'annulee');

  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const isFormateur = req.profile.role === 'formateur' && data.formateur_id === req.user.id;

  res.json({
    formation: { ...data, nb_inscrits: count || 0, places_restantes: data.capacite_max - (count || 0) },
    participants: (isStaff || isFormateur) ? (inscrits || []) : [],
  });
});

// POST /api/formations — Créer une formation (formateur uniquement)
app.post('/api/formations', authenticate, requireRoles('formateur'), async (req, res) => {
  const { titre, description, formateur_id, espace_id, date_debut, date_fin, capacite_max, prix_inscription, programme, prerequis, materiel } = req.body;

  if (!titre || !formateur_id || !date_debut || !date_fin || !capacite_max) {
    return res.status(400).json({ error: 'titre, formateur_id, date_debut, date_fin et capacite_max sont requis.' });
  }
  if (new Date(date_debut) >= new Date(date_fin)) {
    return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  // Sécurité : un formateur ne peut créer des formations que pour lui-même
  if (formateur_id !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez créer des formations que pour votre propre compte.' });
  }

  // Vérifier que le formateur existe
  const { data: formateur, error: fErr } = await supabaseAdmin
    .from('profiles').select('id').eq('id', formateur_id).eq('role', 'formateur').single();
  if (fErr || !formateur) return res.status(404).json({ error: 'Formateur introuvable.' });

  // Vérifier disponibilité de la salle si fournie
  if (espace_id) {
    const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin);
    if (overlap) return res.status(409).json({ error: 'La salle est déjà réservée sur ce créneau.' });
  }

  const { data, error } = await supabaseAdmin
    .from('formations')
    .insert({ titre, description: description || null, formateur_id, espace_id: espace_id || null, date_debut, date_fin, capacite_max: parseInt(capacite_max), prix_inscription: parseFloat(prix_inscription || 0), programme: programme || null, prerequis: prerequis || null, materiel: materiel || null, statut: 'planifiee', tenant_id: req.tenantId })
    .select(`*, profiles!formateur_id (id, nom, prenom), espaces (id, nom, type)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ formation: data });
});

// PATCH /api/formations/:id — Modifier une formation
app.patch('/api/formations/:id', authenticate, async (req, res) => {
  const isStaff = ['admin', 'staff'].includes(req.profile.role);
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('formations').select('*').eq('id', req.params.id).single();
  if (fetchErr || !existing) return res.status(404).json({ error: 'Formation introuvable.' });

  const isFormateur = req.profile.role === 'formateur' && existing.formateur_id === req.user.id;
  if (!isStaff && !isFormateur) return res.status(403).json({ error: 'Droits insuffisants.' });

  const allowed = ['titre', 'description', 'espace_id', 'date_debut', 'date_fin', 'capacite_max', 'prix_inscription', 'statut', 'programme', 'prerequis', 'materiel'];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.date_debut || updates.date_fin) {
    const debut = updates.date_debut || existing.date_debut;
    const fin = updates.date_fin || existing.date_fin;
    if (new Date(debut) >= new Date(fin)) return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  const { data, error } = await supabaseAdmin
    .from('formations').update(updates).eq('id', req.params.id)
    .select(`*, profiles!formateur_id (id, nom, prenom), espaces (id, nom, type)`).single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ formation: data });
});

// DELETE /api/formations/:id — Annuler/supprimer une formation
app.delete('/api/formations/:id', authenticate, async (req, res) => {
  const isAdmin = ['admin'].includes(req.profile.role);
  const isFormateur = req.profile.role === 'formateur';

  if (!isAdmin && !isFormateur) {
    return res.status(403).json({ error: 'Droits insuffisants pour cette action.' });
  }

  const { data: formation, error: fetchErr } = await supabaseAdmin
    .from('formations').select('id, statut, titre, formateur_id').eq('id', req.params.id).single();
  if (fetchErr || !formation) return res.status(404).json({ error: 'Formation introuvable.' });

  // Le formateur ne peut supprimer que ses propres formations
  if (isFormateur && formation.formateur_id !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres formations.' });
  }

  // Annuler plutôt que supprimer si des inscrits existent
  const { count } = await supabaseAdmin
    .from('inscriptions_formations').select('*', { count: 'exact', head: true })
    .eq('formation_id', req.params.id).neq('statut', 'annulee');

  if ((count || 0) > 0) {
    const { error } = await supabaseAdmin
      .from('formations').update({ statut: 'annulee', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ message: `Formation "${formation.titre}" marquée comme annulée (${count} inscrit(s) concerné(s)).` });
  }

  const { error } = await supabaseAdmin.from('formations').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Formation supprimée.' });
});

// =========================================================================
// MODULE G — INSCRIPTIONS (Dev 2 — S5)
// =========================================================================

// POST /api/formations/:id/inscriptions — S'inscrire à une formation
app.post('/api/formations/:id/inscriptions', authenticate, async (req, res) => {
  const formationId = req.params.id;

  const { data: formation, error: fErr } = await supabaseAdmin
    .from('formations').select('*').eq('id', formationId).single();
  if (fErr || !formation) return res.status(404).json({ error: 'Formation introuvable.' });
  if (formation.statut === 'annulee') return res.status(400).json({ error: 'Cette formation est annulée.' });
  if (formation.statut === 'terminee') return res.status(400).json({ error: 'Cette formation est terminée.' });

  // Vérifier inscription existante
  const { data: existing } = await supabaseAdmin
    .from('inscriptions_formations').select('id, statut').eq('formation_id', formationId).eq('user_id', req.user.id).maybeSingle();

  if (existing && existing.statut !== 'annulee') {
    return res.status(409).json({ error: 'Vous êtes déjà inscrit à cette formation.' });
  }

  // Vérifier places disponibles
  const { count: nbInscrits } = await supabaseAdmin
    .from('inscriptions_formations').select('*', { count: 'exact', head: true })
    .eq('formation_id', formationId).neq('statut', 'annulee');

  const placesRestantes = formation.capacite_max - (nbInscrits || 0);

  if (placesRestantes <= 0) {
    // Ajouter en liste d'attente
    const { data: attente, error: atErr } = await supabaseAdmin
      .from('inscriptions_formations')
      .upsert({ formation_id: formationId, user_id: req.user.id, statut: 'en_attente', statut_paiement: formation.prix_inscription > 0 ? 'en_attente' : 'gratuit', updated_at: new Date().toISOString() }, { onConflict: 'formation_id,user_id' })
      .select().single();
    if (atErr) return res.status(400).json({ error: atErr.message });
    return res.status(201).json({ inscription: attente, message: 'Formation complète — ajouté en liste d\'attente.', liste_attente: true });
  }

  // Inscription confirmée
  const { data: inscription, error: insErr } = await supabaseAdmin
    .from('inscriptions_formations')
    .upsert({ formation_id: formationId, user_id: req.user.id, statut: 'confirmee', statut_paiement: formation.prix_inscription > 0 ? 'en_attente' : 'gratuit', updated_at: new Date().toISOString() }, { onConflict: 'formation_id,user_id' })
    .select().single();

  if (insErr) return res.status(400).json({ error: insErr.message });

  // Créer un paiement associé si la formation est payante
  if (formation.prix_inscription > 0 && !inscription.paiement_id) {
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('paiements')
      .insert({
        user_id: req.user.id,
        reservation_id: null,
        abonnement_id: null,
        montant: parseFloat(formation.prix_inscription),
        mode: 'online',
        statut: 'pending',
        date_paiement: null,
      })
      .select()
      .single();

    if (payErr) {
      console.error('Erreur création paiement formation:', payErr.message);
      return res.status(500).json({ error: 'Impossible de créer le paiement associé à l\'inscription.' });
    }

    await supabaseAdmin
      .from('inscriptions_formations')
      .update({ paiement_id: payment.id })
      .eq('id', inscription.id);

    inscription.paiement_id = payment.id;
  }

  // Notification Module F
  try {
    const { notifyInscriptionFormation } = require('./services/notificationService');
    await notifyInscriptionFormation(supabaseAdmin,
      { id: formationId, titre: formation.titre, date_debut: formation.date_debut, date_fin: formation.date_fin },
      { id: req.user.id, nom: req.profile.nom, prenom: req.profile.prenom, email: req.user.email }
    );
  } catch (notifErr) { console.warn('⚠️  Notif inscription formation:', notifErr.message); }

  res.status(201).json({ inscription, message: 'Inscription confirmée.', places_restantes: placesRestantes - 1 });
});

// POST /api/formations/:id/inscriptions/payment — Créer un paiement manquant pour une inscription
app.post('/api/formations/:id/inscriptions/payment', authenticate, async (req, res) => {
  const formationId = req.params.id;
  console.log('POST /api/formations/:id/inscriptions/payment', { formationId, userId: req.user.id });

  try {
    const { data: inscription, error: insErr } = await supabaseAdmin
      .from('inscriptions_formations')
      .select('*')
      .eq('formation_id', formationId)
      .eq('user_id', req.user.id)
      .single();

    if (insErr || !inscription) return res.status(404).json({ error: 'Inscription introuvable.' });
    if (inscription.statut !== 'confirmee') {
      return res.status(400).json({ error: 'Paiement possible uniquement pour une inscription confirmée.' });
    }

    const { data: formation, error: formationErr } = await supabaseAdmin
      .from('formations')
      .select('id, titre, prix_inscription')
      .eq('id', formationId)
      .single();

    if (formationErr || !formation) {
      console.error('Erreur récupération formation liée', formationErr);
      return res.status(500).json({ error: 'Impossible de récupérer la formation liée.' });
    }
    if (parseFloat(formation.prix_inscription) <= 0) {
      return res.status(400).json({ error: 'Cette formation est gratuite, aucun paiement requis.' });
    }

    if (inscription.paiement_id) {
      const { data: existingPayment, error: payErr } = await supabaseAdmin
        .from('paiements')
        .select('*')
        .eq('id', inscription.paiement_id)
        .single();
      if (payErr || !existingPayment) {
        return res.status(500).json({ error: 'Impossible de retrouver le paiement existant.' });
      }
      return res.json({ payment: existingPayment });
    }

    const { data: payment, error: payErr } = await supabaseAdmin
      .from('paiements')
      .insert({
        user_id: req.user.id,
        reservation_id: null,
        abonnement_id: null,
        montant: parseFloat(formation.prix_inscription),
        mode: 'online',
        statut: 'pending',
        date_paiement: null,
      })
      .select()
      .single();

    if (payErr) {
      console.error('Erreur création paiement formation à la demande :', payErr);
      return res.status(500).json({ error: payErr.message || 'Impossible de créer le paiement.' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('inscriptions_formations')
      .update({ paiement_id: payment.id })
      .eq('id', inscription.id);

    if (updErr) {
      console.error('Erreur mise à jour inscription paiement_id :', updErr.message, updErr);
    }

    res.status(201).json({ payment });
  } catch (err) {
    console.error('Erreur route /inscriptions/payment :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création du paiement.' });
  }
});

// DELETE /api/formations/:id/inscriptions — Annuler son inscription
app.delete('/api/formations/:id/inscriptions', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const targetUserId = (isStaff && req.body.user_id) ? req.body.user_id : req.user.id;

  const { data: inscription, error: fetchErr } = await supabaseAdmin
    .from('inscriptions_formations').select('*').eq('formation_id', req.params.id).eq('user_id', targetUserId).single();
  if (fetchErr || !inscription) return res.status(404).json({ error: 'Inscription introuvable.' });

  const { error } = await supabaseAdmin
    .from('inscriptions_formations')
    .update({ statut: 'annulee', updated_at: new Date().toISOString() })
    .eq('id', inscription.id);
  if (error) return res.status(400).json({ error: error.message });

  // Promouvoir premier en liste d'attente
  const { data: premier } = await supabaseAdmin
    .from('inscriptions_formations').select('*').eq('formation_id', req.params.id).eq('statut', 'en_attente').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (premier) {
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('formations')
      .select('prix_inscription')
      .eq('id', req.params.id)
      .single();

    const updates = { statut: 'confirmee', updated_at: new Date().toISOString() };

    if (payment?.prix_inscription > 0 && !premier.paiement_id) {
      const { data: newPayment, error: payInsertErr } = await supabaseAdmin
        .from('paiements')
        .insert({
          user_id: premier.user_id,
          reservation_id: null,
          abonnement_id: null,
          montant: parseFloat(payment.prix_inscription),
          mode: 'online',
          statut: 'pending',
          date_paiement: null,
        })
        .select()
        .single();

      if (payInsertErr) {
        console.error('Erreur création paiement promotion liste d\'attente :', payInsertErr.message);
      } else {
        updates.paiement_id = newPayment.id;
      }
    }

    await supabaseAdmin.from('inscriptions_formations')
      .update(updates).eq('id', premier.id);
  }

  res.json({ message: 'Inscription annulée.', promoted: !!premier });
});

// GET /api/formations/:id/inscriptions — Liste participants (admin/formateur)
app.get('/api/formations/:id/inscriptions', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const { data: formation } = await supabaseAdmin.from('formations').select('formateur_id').eq('id', req.params.id).single();
  const isFormateur = req.profile.role === 'formateur' && formation?.formateur_id === req.user.id;
  if (!isStaff && !isFormateur) return res.status(403).json({ error: 'Accès réservé à l\'admin ou au formateur.' });

  const { data, error } = await supabaseAdmin
    .from('inscriptions_formations')
    .select('*, profiles!user_id (id, nom, prenom, email, telephone, type_membre)')
    .eq('formation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const confirmes = (data || []).filter(i => i.statut === 'confirmee');
  const attente = (data || []).filter(i => i.statut === 'en_attente');

  res.json({ participants: confirmes, liste_attente: attente, total: data.length });
});

// PATCH /api/formations/:id/inscriptions/:userId/presence — Marquer présence
app.patch('/api/formations/:id/inscriptions/:userId/presence', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const { data: formation } = await supabaseAdmin.from('formations').select('formateur_id').eq('id', req.params.id).single();
  const isFormateur = req.profile.role === 'formateur' && formation?.formateur_id === req.user.id;
  if (!isStaff && !isFormateur) return res.status(403).json({ error: 'Droits insuffisants.' });

  const { data, error } = await supabaseAdmin
    .from('inscriptions_formations')
    .update({ present: req.body.present !== false, updated_at: new Date().toISOString() })
    .eq('formation_id', req.params.id)
    .eq('user_id', req.params.userId)
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ inscription: data });
});

// GET /api/formations/:id/emargement — Export liste d'émargement JSON
app.get('/api/formations/:id/emargement', authenticate, async (req, res) => {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const { data: formation } = await supabaseAdmin
    .from('formations')
    .select('*, profiles!formateur_id (nom, prenom), espaces (nom)')
    .eq('id', req.params.id).single();
  if (!formation) return res.status(404).json({ error: 'Formation introuvable.' });

  const isFormateur = req.profile.role === 'formateur' && formation.formateur_id === req.user.id;
  if (!isStaff && !isFormateur) return res.status(403).json({ error: 'Droits insuffisants.' });

  const { data: inscrits } = await supabaseAdmin
    .from('inscriptions_formations')
    .select('*, profiles!user_id (nom, prenom, email, telephone)')
    .eq('formation_id', req.params.id)
    .eq('statut', 'confirmee')
    .order('created_at', { ascending: true });

  res.json({
    formation: {
      titre: formation.titre,
      date: new Date(formation.date_debut).toLocaleDateString('fr-FR'),
      horaire: `${new Date(formation.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} – ${new Date(formation.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      formateur: formation.profiles ? `${formation.profiles.prenom} ${formation.profiles.nom}` : '—',
      salle: formation.espaces?.nom || '—',
    },
    participants: (inscrits || []).map((i, idx) => ({
      numero: idx + 1,
      nom: i.profiles?.nom || '—',
      prenom: i.profiles?.prenom || '—',
      email: i.profiles?.email || '—',
      telephone: i.profiles?.telephone || '—',
      present: i.present,
      statut_paiement: i.statut_paiement,
    })),
  });
});

// GET /api/members/me/formations — Formations auxquelles le membre est inscrit
app.get('/api/members/me/formations', authenticate, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('inscriptions_formations')
    .select('*, formations (id, titre, date_debut, date_fin, statut, prix_inscription, profiles!formateur_id (nom, prenom))')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ inscriptions: data });
});

// =========================================================================
// MESSAGERIE — Temps réel
// =========================================================================

// GET /api/conversations — Liste conversations de l'utilisateur
app.get('/api/conversations', authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data: memberships, error: mErr } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', req.user.id);

  if (mErr) return res.status(500).json({ error: mErr.message });

  const convIds = (memberships || []).map(m => m.conversation_id);
  if (convIds.length === 0) return res.json({ conversations: [], total: 0 });

  const { data: conversations, error, count } = await supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact' })
    .in('id', convIds)
    .order('updated_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) return res.status(500).json({ error: error.message });

  // Enrichir avec dernier message + unread count
  const enriched = await Promise.all((conversations || []).map(async (conv) => {
    const { data: lastMsg } = await supabaseAdmin
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const membership = memberships.find(m => m.conversation_id === conv.id);
    const lastRead = membership?.last_read_at || '1970-01-01T00:00:00Z';

    const { count: unreadCount } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', req.user.id)
      .gt('created_at', lastRead);

    return { ...conv, last_message: lastMsg, unread_count: unreadCount || 0 };
  }));

  res.json({ conversations: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
});

// POST /api/conversations — Créer une conversation
app.post('/api/conversations', authenticate, async (req, res) => {
  const { title, type = 'support' } = req.body;

  const { data: conv, error } = await supabaseAdmin
    .from('conversations')
    .insert({ title: title || 'Support 33S', type, created_by: req.user.id })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabaseAdmin.from('conversation_members').insert({
    conversation_id: conv.id,
    user_id: req.user.id,
  });

  res.json({ conversation: conv });
});

// GET /api/conversations/:id — Détails conversation + messages
app.get('/api/conversations/:id', authenticate, async (req, res) => {
  const { data: membership } = await supabaseAdmin
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Accès refusé.' });

  const { data: conversation, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Conversation introuvable.' });

  res.json({ conversation, membership });
});

// GET /api/conversations/:id/messages — Messages d'une conversation
app.get('/api/conversations/:id/messages', authenticate, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data: membership } = await supabaseAdmin
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Accès refusé.' });

  const { data: messages, error, count } = await supabaseAdmin
    .from('messages')
    .select('*, profiles!sender_id (id, nom, prenom, avatar_url, role)', { count: 'exact' })
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ messages: messages || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
});

// POST /api/conversations/:id/messages — Envoyer un message
app.post('/api/conversations/:id/messages', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Message vide.' });

  const { data: membership } = await supabaseAdmin
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Accès refusé.' });

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({ conversation_id: req.params.id, sender_id: req.user.id, content: content.trim() })
    .select('*, profiles!sender_id (id, nom, prenom, avatar_url, role)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Mettre à jour updated_at de la conversation
  await supabaseAdmin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', req.params.id);

  // Notifier les autres membres via Socket.io
  const { emitToUser } = require('./services/socketService');
  const { data: otherMembers } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', req.params.id)
    .neq('user_id', req.user.id);

  (otherMembers || []).forEach(m => {
    emitToUser(m.user_id, 'message:received', { conversation_id: req.params.id, message });
  });

  res.json({ message });
});

// PATCH /api/conversations/:id/read — Marquer conversation comme lue
app.patch('/api/conversations/:id/read', authenticate, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/messages/unread-count — Nombre total de messages non lus
app.get('/api/messages/unread-count', authenticate, async (req, res) => {
  const { data: memberships } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', req.user.id);

  if (!memberships || memberships.length === 0) return res.json({ count: 0 });

  let totalUnread = 0;
  for (const m of memberships) {
    const lastRead = m.last_read_at || '1970-01-01T00:00:00Z';
    const { count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', m.conversation_id)
      .neq('sender_id', req.user.id)
      .gt('created_at', lastRead);
    totalUnread += count || 0;
  }

  res.json({ count: totalUnread });
});

// GET /api/admin/members — Liste des membres (pour admin messagerie)
app.get('/api/admin/members', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { search = '' } = req.query;

  let query = supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email, telephone, type_membre, role, created_at')
    .in('role', ['member', 'guest'])
    .order('nom', { ascending: true });

  query = applyTenantFilter(query, req);

  if (search.trim()) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ members: data || [] });
});

// POST /api/admin/conversations — Créer une conversation admin→membre
app.post('/api/admin/conversations', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { member_id, title } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id requis.' });

  const { data: member } = await supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom')
    .eq('id', member_id)
    .single();

  if (!member) return res.status(404).json({ error: 'Membre introuvable.' });

  // Vérifier si une conversation support existe déjà entre cet admin et ce membre
  const { data: existingMemberships } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', req.user.id);

  if (existingMemberships && existingMemberships.length > 0) {
    const adminConvIds = existingMemberships.map(m => m.conversation_id);
    const { data: memberInConvs } = await supabaseAdmin
      .from('conversation_members')
      .select('conversation_id')
      .in('conversation_id', adminConvIds)
      .eq('user_id', member_id);

    if (memberInConvs && memberInConvs.length > 0) {
      // Conversation déjà existante — la retourner
      const convId = memberInConvs[0].conversation_id;
      const { data: conv } = await supabaseAdmin.from('conversations').select('*').eq('id', convId).single();
      return res.json({ conversation: conv, existing: true });
    }
  }

  // Créer nouvelle conversation
  const convTitle = title || `${member.prenom} ${member.nom}`;
  const { data: conv, error } = await supabaseAdmin
    .from('conversations')
    .insert({ title: convTitle, type: 'support', created_by: req.user.id, tenant_id: req.tenantId })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Ajouter admin + membre comme membres
  await supabaseAdmin.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: req.user.id },
    { conversation_id: conv.id, user_id: member_id },
  ]);

  // Notifier le membre via Socket.io
  const { emitToUser } = require('./services/socketService');
  emitToUser(member_id, 'conversation:update', {
    conversation_id: conv.id,
    last_message: null,
    title: convTitle,
  });

  res.status(201).json({ conversation: conv, existing: false });
});

// GET /api/admin/conversations — Admin voit toutes les conversations
app.get('/api/admin/conversations', authenticate, requireRoles('super_admin', 'admin', 'staff'), async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  query = applyTenantFilter(query, req);

  const { data: conversations, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });

  // Enrichir avec dernier message + membre info + unread
  const enriched = await Promise.all((conversations || []).map(async (conv) => {
    // Trouver le membre (non-staff) dans cette conversation
    const { data: members } = await supabaseAdmin
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conv.id);

    const memberIds = (members || []).map(m => m.user_id);

    // Récupérer les profils
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, nom, prenom, email, role, type_membre')
      .in('id', memberIds);

    const memberProfile = (profiles || []).find(p => !['super_admin', 'admin', 'staff'].includes(p.role));
    const staffProfiles = (profiles || []).filter(p => ['super_admin', 'admin', 'staff'].includes(p.role));

    // Dernier message
    const { data: lastMsg } = await supabaseAdmin
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Unread count for admin
    const { data: adminMembership } = await supabaseAdmin
      .from('conversation_members')
      .select('last_read_at')
      .eq('conversation_id', conv.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    const lastRead = adminMembership?.last_read_at || '1970-01-01T00:00:00Z';
    const { count: unreadCount } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', req.user.id)
      .gt('created_at', lastRead);

    return {
      ...conv,
      member: memberProfile || null,
      staff: staffProfiles || [],
      last_message: lastMsg,
      unread_count: unreadCount || 0,
    };
  }));

  // Filtrer par recherche membre
  let result = enriched;
  if (search.trim()) {
    const s = search.toLowerCase();
    result = enriched.filter(c =>
      c.member && (
        (c.member.nom || '').toLowerCase().includes(s) ||
        (c.member.prenom || '').toLowerCase().includes(s) ||
        (c.member.email || '').toLowerCase().includes(s)
      )
    );
  }

  res.json({ conversations: result, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
});

// =========================================================================
// MODULE E — Portail Membre (S4 — CDC E)
// =========================================================================

app.get('/api/bookings/history', authenticate, async (req, res) => {
  const { page = 1, limit = 10, statut } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin
    .from('reservations')
    .select(`
      *,
      espaces (id, nom, type, tarif_horaire),
      profiles (nom, prenom, email)
    `, { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('date_debut', { ascending: false });

  if (statut) query = query.eq('statut', statut);

  const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });

  const { data: allBookings } = await supabaseAdmin
    .from('reservations')
    .select('id, statut, date_debut, date_fin, montant_total')
    .eq('user_id', req.user.id);

  const stats = {
    total: allBookings?.length || 0,
    confirmed: allBookings?.filter(b => b.statut === 'confirmed').length || 0,
    pending: allBookings?.filter(b => b.statut === 'pending').length || 0,
    cancelled: allBookings?.filter(b => b.statut === 'cancelled').length || 0,
    completed: allBookings?.filter(b => b.statut === 'completed').length || 0,
    totalHours: allBookings?.reduce((acc, b) => {
      if (b.date_debut && b.date_fin) {
        return acc + (new Date(b.date_fin) - new Date(b.date_debut)) / (1000 * 60 * 60);
      }
      return acc;
    }, 0).toFixed(1) || 0,
    totalSpent: allBookings?.reduce((acc, b) => acc + (parseFloat(b.montant_total) || 0), 0).toFixed(2) || '0.00',
  };

  res.json({ bookings: data || [], stats, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / parseInt(limit)) } });
});

app.get('/api/member/stats', authenticate, async (req, res) => {
  const userId = req.user.id;

  const [bookingsRes, subsRes, paymentsRes] = await Promise.all([
    supabaseAdmin.from('reservations').select('id, statut, montant_total, date_debut, date_fin').eq('user_id', userId),
    supabaseAdmin.from('abonnements').select('id, statut, date_debut, date_fin, type_abonnement').eq('user_id', userId),
    supabaseAdmin.from('paiements').select('id, montant, statut, mode_paiement, created_at').eq('user_id', userId),
  ]);

  const bookings = bookingsRes.data || [];
  const subs = subsRes.data || [];
  const payments = paymentsRes.data || [];
  const totalHours = bookings.reduce((acc, b) => {
    if (b.date_debut && b.date_fin) return acc + (new Date(b.date_fin) - new Date(b.date_debut)) / (1000 * 60 * 60);
    return acc;
  }, 0);
  const activeSub = subs.find(s => s.statut === 'active');

  res.json({
    bookings: { total: bookings.length, confirmed: bookings.filter(b => b.statut === 'confirmed').length, completed: bookings.filter(b => b.statut === 'completed').length, cancelled: bookings.filter(b => b.statut === 'cancelled').length, totalSpent: bookings.reduce((a, b) => a + (parseFloat(b.montant_total) || 0), 0).toFixed(2) },
    subscription: activeSub ? { type: activeSub.type_abonnement, active: true, date_fin: activeSub.date_fin, daysLeft: Math.max(0, Math.ceil((new Date(activeSub.date_fin) - new Date()) / (1000 * 60 * 60 * 24))) } : { active: false },
    payments: { total: payments.length, paid: payments.filter(p => p.statut === 'paid').length, pending: payments.filter(p => p.statut === 'pending').length, totalAmount: payments.filter(p => p.statut === 'paid').reduce((a, p) => a + (parseFloat(p.montant) || 0), 0).toFixed(2) },
    totalHours: totalHours.toFixed(1),
    memberSince: subs.length > 0 ? subs.sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut))[0].date_debut : null,
  });
});

app.get('/api/member/notifications', authenticate, async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin.from('notifications').select('*', { count: 'exact' }).eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (unread_only === 'true') query = query.eq('lu', false);

  const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });

  const { count: unreadCount } = await supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('lu', false);

  res.json({ notifications: data || [], unreadCount: unreadCount || 0, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / parseInt(limit)) } });
});

app.patch('/api/member/notifications/:id/read', authenticate, async (req, res) => {
  const { error } = await supabaseAdmin.from('notifications').update({ lu: true }).eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/member/notifications/read-all', authenticate, async (req, res) => {
  const { error } = await supabaseAdmin.from('notifications').update({ lu: true }).eq('user_id', req.user.id).eq('lu', false);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

app.patch('/api/members/me/settings', authenticate, async (req, res) => {
  const allowed = ['notif_email_reservations', 'notif_email_abonnements', 'notif_email_formations'];
  const updates = {};
  for (const field of allowed) { if (req.body[field] !== undefined) updates[field] = req.body[field]; }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Aucune préférence fournie.' });
  const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: data });
});

// Démarrage des tâches planifiées (Cron)
startPaymentRemindersCron(supabaseAdmin);
startReservationRemindersCron(supabaseAdmin);
startSubscriptionRemindersCron(supabaseAdmin);
startFormationRemindersCron(supabaseAdmin);

// ── Modules H, J, K, L, N ──────────────────────────────────────────────
const modulesHJKLNRouter = createModulesHJKLNRouter({ supabaseAdmin, authenticate, requireRoles, applyTenantFilter });
app.use('/api', modulesHJKLNRouter);

// Socket.io (Module B+ — Sessions temps réel)
const http = require('http');
const server = http.createServer(app);
initSocket(server, supabaseUrl, supabaseServiceKey);

server.listen(PORT, () => {
  console.log(`API Dev 1 + Dev 2 démarrée sur http://localhost:${PORT}`);
  console.log('✅ Module F - Notifications automatiques activées.');
  console.log('✅ Module B+ - Socket.io temps réel activé.');
});
