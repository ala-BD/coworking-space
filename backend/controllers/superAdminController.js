// controllers/superAdminController.js — MODULE S6 : Super Admin (Tenants + Users)
const { supabaseAdmin } = require('../config/supabase');
const { auditLog } = require('../middleware/guards');

// GET /api/super-admin/tenants
async function listTenants(req, res) {
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
      .from('profiles').select('*', { count: 'exact', head: true })
      .eq('tenant_id', t.id).in('role', ['member', 'guest']);
    const { count: spaceCount } = await supabaseAdmin
      .from('espaces').select('*', { count: 'exact', head: true })
      .eq('tenant_id', t.id);
    return { ...t, member_count: memberCount || 0, space_count: spaceCount || 0 };
  }));

  res.json({ tenants: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
}

// GET /api/super-admin/tenants/:id
async function getTenant(req, res) {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants').select('*').eq('id', req.params.id).single();
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
}

// POST /api/super-admin/tenants
async function createTenant(req, res) {
  const { nom, slug, description, adresse, ville, pays, email, telephone, site_web, plan, tier, montant_mensuel, limite_membres, limite_espaces } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom du coworking est requis.' });

  const tenantSlug = slug || nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabaseAdmin.from('tenants').insert({
    nom, slug: tenantSlug, description: description || null,
    adresse: adresse || null, ville: ville || null, pays: pays || 'Tunisie',
    email: email || null, telephone: telephone || null, site_web: site_web || null,
    plan: plan || 'starter', tier: tier || 'C', montant_mensuel: montant_mensuel || 0,
    limite_membres: limite_membres || 100, limite_espaces: limite_espaces || 10,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  await auditLog(req.user.id, 'tenant_created', 'tenant', data.id, data.nom, { plan: data.plan, tier: data.tier }, req.ip);
  res.status(201).json({ tenant: data });
}

// PATCH /api/super-admin/tenants/:id
async function updateTenant(req, res) {
  const allowed = ['nom', 'description', 'adresse', 'ville', 'pays', 'email', 'telephone', 'site_web', 'logo_url', 'cover_url', 'latitude', 'longitude', 'statut', 'plan', 'tier', 'montant_mensuel', 'derniere_facture', 'prochaine_echeance', 'limite_membres', 'limite_espaces', 'settings'];
  const updates = { updated_at: new Date().toISOString() };
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });

  const { data, error } = await supabaseAdmin.from('tenants').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (updates.statut !== undefined) {
    const nextProfileStatut = updates.statut === 'actif' ? 'actif' : 'suspendu';
    await supabaseAdmin.from('profiles')
      .update({ statut_compte: nextProfileStatut, updated_at: new Date().toISOString() })
      .eq('tenant_id', req.params.id).eq('role', 'admin');
  }

  await auditLog(req.user.id, 'tenant_updated', 'tenant', data.id, data.nom, { fields: Object.keys(updates) }, req.ip);
  res.json({ tenant: data });
}

// DELETE /api/super-admin/tenants/:id
async function deleteTenant(req, res) {
  const { data: tenant, error: fetchErr } = await supabaseAdmin.from('tenants').select('id, nom').eq('id', req.params.id).single();
  if (fetchErr || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const { error } = await supabaseAdmin.from('tenants').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  await auditLog(req.user.id, 'tenant_deleted', 'tenant', tenant.id, tenant.nom, {}, req.ip);
  res.json({ message: `Coworking "${tenant.nom}" supprimé.` });
}

// POST /api/super-admin/tenants/:id/onboard
async function onboardTenant(req, res) {
  const { email, nom, prenom, telephone } = req.body;
  if (!email) return res.status(400).json({ error: "Email de l'admin requis." });

  const { data: tenant, error: tErr } = await supabaseAdmin.from('tenants').select('*').eq('id', req.params.id).single();
  if (tErr || !tenant) return res.status(404).json({ error: 'Coworking introuvable.' });

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { role: 'admin', tenant_id: tenant.id, nom: nom || tenant.nom, prenom: prenom || 'Admin', telephone: telephone || '' },
    redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
  });

  if (authErr) return res.status(400).json({ error: authErr.message });

  await supabaseAdmin.from('tenants').update({ contact_admin_id: authUser.user.id }).eq('id', tenant.id);
  await auditLog(req.user.id, 'tenant_onboarded', 'tenant', tenant.id, tenant.nom, { admin_email: email }, req.ip);
  res.json({ message: `Invitation envoyée à ${email} pour gérer "${tenant.nom}".`, user: { id: authUser.user.id, email } });
}

// GET /api/super-admin/stats?period=jour|mois|annee|tout
function getPeriodWindow(period, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  let fromJ, toJ, bucket;
  switch (period) {
    case 'jour':
      fromJ = new Date(y, m, now.getDate(), 0, 0, 0, 0);
      toJ = new Date(y, m, now.getDate(), 23, 59, 59, 999);
      bucket = 'hour';
      break;
    case 'annee':
      fromJ = new Date(y, 0, 1, 0, 0, 0, 0);
      toJ = new Date(y, 11, 31, 23, 59, 59, 999);
      bucket = 'month';
      break;
    case 'tout':
      fromJ = new Date(2020, 0, 1, 0, 0, 0, 0);
      toJ = new Date(y, m, now.getDate(), 23, 59, 59, 999);
      bucket = 'year';
      break;
    case 'mois':
    default:
      fromJ = new Date(y, m, 1, 0, 0, 0, 0);
      toJ = new Date(y, m + 1, 0, 23, 59, 59, 999);
      bucket = 'day';
      break;
  }
  return { period, from: fromJ.toISOString(), to: toJ.toISOString(), fromJ, toJ, bucket };
}

function buildBuckets(win) {
  const out = [];
  const start = win.fromJ;
  if (win.bucket === 'hour') {
    for (let h = 0; h < 24; h++) {
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h, 0, 0, 0);
      const e = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h, 59, 59, 999);
      out.push({ label: `${String(h).padStart(2, '0')}h`, start: s, end: e });
    }
  } else if (win.bucket === 'day') {
    const y = start.getFullYear(); const m = start.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      out.push({ label: String(d), start: new Date(y, m, d, 0, 0, 0, 0), end: new Date(y, m, d, 23, 59, 59, 999) });
    }
  } else if (win.bucket === 'month') {
    const y = start.getFullYear();
    for (let i = 0; i < 12; i++) {
      const s = new Date(y, i, 1);
      out.push({ label: s.toLocaleDateString('fr-FR', { month: 'short' }), start: s, end: new Date(y, i + 1, 0, 23, 59, 59, 999) });
    }
  } else {
    for (let yr = start.getFullYear(); yr <= win.toJ.getFullYear(); yr++) {
      out.push({ label: String(yr), start: new Date(yr, 0, 1), end: new Date(yr, 11, 31, 23, 59, 59, 999) });
    }
  }
  return out;
}

function pctChange(cur, prev) {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return cur > 0 ? 100 : 0;
}

async function getStats(req, res) {
  try {
    const period = String(req.query.period || 'mois');
    const win = getPeriodWindow(period);
    const prevEnd = new Date(win.fromJ.getTime() - 1);
    const prevFrom = new Date(prevEnd.getTime() - (win.toJ.getTime() - win.fromJ.getTime()));
    const prevWin = { from: prevFrom.toISOString(), to: prevEnd.toISOString() };

    const [allTenantsRes, newTenantsRes, prevTenantsRes, activeTenantsRes, suspendedTenantsRes,
      allMembersRes, newMembersRes, prevMembersRes] = await Promise.all([
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).gte('created_at', win.from).lte('created_at', win.to),
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).gte('created_at', prevWin.from).lte('created_at', prevWin.to),
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'actif').lte('created_at', win.to),
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'suspendu').gte('created_at', win.from).lte('created_at', win.to),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['member', 'guest']),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['member', 'guest']).gte('created_at', win.from).lte('created_at', win.to),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['member', 'guest']).gte('created_at', prevWin.from).lte('created_at', prevWin.to),
    ]);

    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, nom, montant_mensuel, statut, plan, prochaine_echeance, created_at');

    const todayStr = new Date().toISOString().split('T')[0];

    // ── Abonnements VC LOW des coworkings ────────────────────────────────
    const actifs = (tenants || []).filter((t) => t.statut === 'actif');
    const planBreakdown = {};
    actifs.forEach((t) => {
      planBreakdown[t.plan] = (planBreakdown[t.plan] || 0) + 1;
    });

    const impayes = (tenants || []).filter((t) =>
      t.statut !== 'actif' || (t.prochaine_echeance && t.prochaine_echeance < todayStr));
    const overdueAmount = impayes.reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);

    const mrr = actifs.reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);

    // Evolution coworkings / MRR découpée selon la période sélectionnée
    const buckets = buildBuckets(win);
    const monthlyGrowth = buckets.map((b) => {
      const activeInBucket = (tenants || []).filter(t =>
        t.statut === 'actif' && new Date(t.created_at || '2020-01-01') <= b.end);
      const bucketMrr = activeInBucket.reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);
      return {
        mois: b.label,
        coworkings: activeInBucket.length,
        mrr: Math.round(bucketMrr * 100) / 100,
      };
    });

    // ── Coworkings les plus performants (CA généré par tenant sur la période) ──
    const tenantNames = {};
    (tenants || []).forEach((t) => { tenantNames[t.id] = t.nom; });
    const perfMap = {};

    const { data: topPaiements } = await supabaseAdmin
      .from('paiements').select('tenant_id, montant').eq('statut', 'paid')
      .gte('date_paiement', win.from).lte('date_paiement', win.to);
    (topPaiements || []).forEach((p) => {
      if (!p.tenant_id) return;
      if (!perfMap[p.tenant_id]) perfMap[p.tenant_id] = { nom: tenantNames[p.tenant_id] || 'Inconnu', ca: 0, bookings: 0 };
      perfMap[p.tenant_id].ca += parseFloat(p.montant || 0);
    });

    const { data: topReservations } = await supabaseAdmin
      .from('reservations').select('tenant_id').in('statut', ['confirmed', 'pending'])
      .gte('date_debut', win.from).lte('date_debut', win.to);
    (topReservations || []).forEach((r) => {
      if (!r.tenant_id) return;
      if (!perfMap[r.tenant_id]) perfMap[r.tenant_id] = { nom: tenantNames[r.tenant_id] || 'Inconnu', ca: 0, bookings: 0 };
      perfMap[r.tenant_id].bookings += 1;
    });

    const topCoworkings = Object.values(perfMap)
      .sort((a, b) => b.ca - a.ca || b.bookings - a.bookings)
      .slice(0, 5)
      .map((t) => ({ ...t, ca: Math.round(t.ca * 100) / 100 }));

    res.json({
      totalTenants: allTenantsRes.count ?? 0,
      nouveauxTenants: newTenantsRes.count ?? 0,
      tenantEvolution: pctChange(newTenantsRes.count ?? 0, prevTenantsRes.count ?? 0),
      activeTenants: activeTenantsRes.count ?? 0,
      suspendedTenants: suspendedTenantsRes.count ?? 0,
      totalMembers: allMembersRes.count ?? 0,
      nouveauxMembres: newMembersRes.count ?? 0,
      memberEvolution: pctChange(newMembersRes.count ?? 0, prevMembersRes.count ?? 0),
      activeSubscriptions: actifs.length,
      planBreakdown,
      expiredSubscriptions: impayes.length,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      mrr: Math.round(mrr * 100) / 100,
      monthlyGrowth,
      topCoworkings,
      periode: { key: win.period, from: win.from, to: win.to, bucket: win.bucket },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/super-admin/audit
async function getAuditLogs(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { data, error, count } = await supabaseAdmin
    .from('super_admin_audit_log')
    .select('*, profiles!user_id(nom, prenom)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ logs: data || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
}

// GET /api/super-admin/users
async function listUsers(req, res) {
  const { page = 1, limit = 30, role, tenant_id, statut, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin
    .from('profiles')
    .select('id, nom, prenom, email, role, statut_compte, tenant_id, created_at, updated_at, tenants!tenant_id(nom, slug)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (role) query = query.eq('role', role);
  if (tenant_id) query = query.eq('tenant_id', tenant_id);
  if (statut) query = query.eq('statut_compte', statut);
  if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
}

// PATCH /api/super-admin/users/:id
async function updateUser(req, res) {
  const allowed = ['role', 'statut_compte', 'nom', 'prenom', 'telephone', 'tenant_id'];
  const updates = { updated_at: new Date().toISOString() };
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre compte via cette interface.' });

  const { data: target } = await supabaseAdmin.from('profiles').select('nom, prenom, role').eq('id', req.params.id).single();
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Si le statut passe à actif, confirmer automatiquement l'email dans Supabase Auth
  if (updates.statut_compte === 'actif') {
    try {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { email_confirm: true });
    } catch (e) {
      console.warn('⚠️ Erreur confirmation email Supabase Auth:', e.message);
    }
  }

  await auditLog(req.user.id, 'user_updated', 'user', req.params.id, `${target.prenom} ${target.nom}`, { fields: Object.keys(updates) }, req.ip);
  res.json({ user: data });
}

// DELETE /api/super-admin/users/:id
async function deleteUser(req, res) {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });

  const { data: target } = await supabaseAdmin.from('profiles').select('nom, prenom, role').eq('id', req.params.id).single();
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (authErr) return res.status(400).json({ error: authErr.message });

  await auditLog(req.user.id, 'user_deleted', 'user', req.params.id, `${target.prenom} ${target.nom}`, { role: target.role }, req.ip);
  res.json({ message: `Utilisateur "${target.prenom} ${target.nom}" supprimé.` });
}

// GET /api/super-admin/users/roles-summary
async function getRolesSummary(_req, res) {
  const roles = ['member', 'admin', 'staff', 'formateur', 'super_admin', 'guest'];
  const counts = await Promise.all(
    roles.map(async (r) => {
      const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', r);
      return { role: r, count: count || 0 };
    })
  );
  res.json({ summary: counts });
}

module.exports = {
  listTenants, getTenant, createTenant, updateTenant, deleteTenant, onboardTenant,
  getStats, getAuditLogs,
  listUsers, updateUser, deleteUser, getRolesSummary,
};
