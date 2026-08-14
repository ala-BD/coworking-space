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
  const allowed = ['nom', 'description', 'adresse', 'ville', 'pays', 'email', 'telephone', 'site_web', 'logo_url', 'statut', 'plan', 'tier', 'montant_mensuel', 'derniere_facture', 'prochaine_echeance', 'limite_membres', 'limite_espaces', 'settings'];
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

// GET /api/super-admin/stats
async function getStats(_req, res) {
  const [{ count: totalTenants }, { count: activeTenants }, { count: suspendedTenants }, { count: totalMembers }] = await Promise.all([
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
    supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }).eq('statut', 'suspendu'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['member', 'guest']),
  ]);
  const { data: tenants } = await supabaseAdmin.from('tenants').select('montant_mensuel, statut');
  const mrr = (tenants || []).filter(t => t.statut === 'actif').reduce((acc, t) => acc + (parseFloat(t.montant_mensuel) || 0), 0);
  res.json({ totalTenants: totalTenants || 0, activeTenants: activeTenants || 0, suspendedTenants: suspendedTenants || 0, totalMembers: totalMembers || 0, mrr });
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
