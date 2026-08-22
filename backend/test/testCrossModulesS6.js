/**
 * testCrossModulesS6.js — Tests croisés S6 (DEV1 : Modules A · B · B+ · E)
 * ─────────────────────────────────────────────────────────────────────────
 * Usage :
 *   1. Démarrer le serveur : node backend/server.js
 *   2. Les comptes de test doivent exister dans Supabase :
 *        verify.member@vclow.tn  / Verif@12345
 *        verify.admin@vclow.tn   / Verif@12345
 *   3. Exécuter : node backend/test/testCrossModulesS6.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const MEMBER_EMAIL = process.env.MEMBER_EMAIL || 'verify.member@vclow.tn';
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || 'Verif@12345';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'verify.admin@vclow.tn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Verif@12345';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let passed = 0;
let failed = 0;
const failures = [];

function log(msg, ok = true) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon}  ${msg}`);
  if (ok) passed++;
  else {
    failed++;
    failures.push(msg);
  }
}

function logSection(title) {
  console.log(`\n${'═'.repeat(58)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(58));
}

async function api(method, path, token, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* corps vide */ }
  return { status: res.status, body: parsed };
}

function isoAddDays(days, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function isoAddMinutes(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

async function main() {
  // ─── Auth ────────────────────────────────────────────────────────────
  logSection('🔐  Authentification Supabase');

  const memberRes = await supabase.auth.signInWithPassword({
    email: MEMBER_EMAIL,
    password: MEMBER_PASSWORD,
  });
  log(`Login membre ${MEMBER_EMAIL}`, !memberRes.error);
  if (memberRes.error) {
    console.error(memberRes.error.message);
    process.exit(1);
  }
  const memberToken = memberRes.data.session.access_token;
  const memberId = memberRes.data.user.id;

  const adminRes = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  log(`Login admin ${ADMIN_EMAIL}`, !adminRes.error);
  if (adminRes.error) {
    console.error(adminRes.error.message);
    process.exit(1);
  }
  const adminToken = adminRes.data.session.access_token;

  // Nettoyage préalable : annule les réservations futures du membre laissées par une exécution précédente
  const { error: cleanupErr } = await supabase
    .from('reservations')
    .update({ statut: 'cancelled' })
    .eq('user_id', memberId)
    .in('statut', ['pending', 'confirmed'])
    .gt('date_debut', new Date().toISOString());
  if (cleanupErr) console.log(`  ⚠️  Pré-nettoyage : ${cleanupErr.message}`);
  else console.log('  ♻️  Résidus de réservations futures nettoyés');

  const { error: cleanupSubErr } = await supabase
    .from('abonnements')
    .update({ statut: 'suspended' })
    .eq('user_id', memberId)
    .eq('statut', 'active');
  if (cleanupSubErr) console.log(`  ⚠️  Pré-nettoyage abonnements : ${cleanupSubErr.message}`);
  else console.log('  ♻️  Abonnements actifs précédents désactivés');

  // ─── Module A — Membres & Abonnements ────────────────────────────────
  logSection('🅰️  Module A — Membres & Abonnements');

  const pricing = await api('GET', '/api/pricing', memberToken);
  log('GET /api/pricing (offres publiques) — 200', pricing.status === 200);
  const planNames = (pricing.body?.plans || pricing.body?.tarifs || []).map((p) => p.nom || p.plan_tarifaire || '?');
  console.log(`      → plans: ${planNames.join(', ') || '(vide)'}`);

  const me = await api('GET', '/api/members/me', memberToken);
  log('GET /api/members/me (profil membre) — 200', me.status === 200 && !!me.body?.profile);
  console.log(`      → membre: ${me.body?.profile?.prenom || ''} ${me.body?.profile?.nom || ''} (role=${me.body?.profile?.role})`);

  const mySubs = await api('GET', '/api/subscriptions/me', memberToken);
  log('GET /api/subscriptions/me — 200', mySubs.status === 200);
  const subsCount = (mySubs.body?.subscriptions || []).length;
  console.log(`      → ${subsCount} abonnement(s) retrouvé(s)`);

  const promoInvalid = await api('POST', '/api/promo-codes/validate', memberToken, { code: 'INEXISTANT-999' });
  log('POST /api/promo-codes/validate (code invalide) — 404/400', [404, 400].includes(promoInvalid.status));

  // Test croisé A : admin crée un abonnement actif pour le membre
  const subPayload = {
    user_id: memberId,
    type: 'mensuel',
    date_debut: new Date().toISOString().split('T')[0],
  };
  const subRes = await api('POST', '/api/subscriptions', adminToken, subPayload);
  log('POST /api/subscriptions (admin → abonnement membre) — 201', subRes.status === 201 && !!subRes.body?.subscription);
  let subId = subRes.body?.subscription?.id || null;
  if (subRes.status === 201) console.log(`      → abonnement ${subRes.body.subscription.type} (${subRes.body.subscription.date_fin})`);

  const myActive = await api('GET', '/api/subscriptions/me/active', memberToken);
  log('GET /api/subscriptions/me/active — 200 + actif', myActive.status === 200 && myActive.body?.subscription?.statut === 'active');

  // ─── Module B — Réservations & Espaces ───────────────────────────────
  logSection('🅱️  Module B — Réservations & Espaces');

  const espaces = await api('GET', '/api/espaces', memberToken);
  log('GET /api/espaces — 200', espaces.status === 200);
  const espaceList = espaces.body?.espaces || [];
  console.log(`      → ${espaceList.length} espace(s)`);
  if (espaceList.length === 0) {
    log('Au moins un espace disponible pour les tests', false);
    return;
  }
  log('Au moins un espace disponible pour les tests', true);
  const espace = espaceList[0];

  const calendar = await api('GET', `/api/bookings/calendar?from=${isoAddMinutes(-120)}&to=${isoAddMinutes(240)}`, memberToken);
  log('GET /api/bookings/calendar — 200', calendar.status === 200 && Array.isArray(calendar.body?.reservations));

  const from = isoAddMinutes(60);
  const to = isoAddMinutes(180);
  const avail = await api('POST', '/api/bookings/check-availability', memberToken, {
    espace_id: espace.id,
    date_debut: from,
    date_fin: to,
  });
  log('POST /api/bookings/check-availability — 200', avail.status === 200 && typeof avail.body?.isAvailable === 'boolean');
  console.log(`      → isAvailable=${avail.body?.isAvailable}`);

  const createRes = await api('POST', '/api/bookings', memberToken, {
    espace_id: espace.id,
    date_debut: from,
    date_fin: to,
    mode: 'online',
  });
  const bookingCreated = createRes.status === 201 && createRes.body?.reservation;
  log('POST /api/bookings (création) — 201', bookingCreated);
  if (!bookingCreated) {
    log(`Création réservation impossible : ${JSON.stringify(createRes.body)}`, false);
  } else {
    const booking = createRes.body.reservation;
    console.log(`      → réservation ${booking.id} (${booking.statut})`);
    const bookingId = booking.id;

    // Conflit : même créneau
    const conflictRes = await api('POST', '/api/bookings', memberToken, {
      espace_id: espace.id,
      date_debut: from,
      date_fin: to,
      mode: 'online',
    });
    log('POST /api/bookings (conflit) — 409', conflictRes.status === 409);
    if (conflictRes.status === 409) console.log(`      → ${conflictRes.body?.error}`);

    // Liste bookings membre
    const myBookings = await api('GET', '/api/bookings', memberToken);
    log('GET /api/bookings (liste membre) — 200', myBookings.status === 200 && Array.isArray(myBookings.body?.reservations));

    // Occupation (admin uniquement)
    const occ = await api('GET', `/api/bookings/occupation?from=${isoAddMinutes(-120)}&to=${isoAddMinutes(240)}`, adminToken);
    log('GET /api/bookings/occupation (staff) — 200', occ.status === 200 && Array.isArray(occ.body?.report));

    // Confirmation admin → prépare le check-in
    const confirmRes = await api('PATCH', `/api/bookings/${bookingId}`, adminToken, { statut: 'confirmed' });
    log('PATCH /api/bookings/:id (confirmation admin) — 200', confirmRes.status === 200 && confirmRes.body?.reservation?.statut === 'confirmed');

    // ─── Module B+ — Sessions Temps Réel ───────────────────────────────
    logSection('🅱️➕  Module B+ — Sessions Temps Réel');

    const checkIn = await api('POST', '/api/sessions/check-in', memberToken, {
      reservation_id: bookingId,
    });
    const checkedIn = checkIn.status === 201 && checkIn.body?.session;
    log('POST /api/sessions/check-in — 201', checkedIn);
    if (checkIn.body?.warning) console.log(`      ⚠️  ${checkIn.body.warning}`);
    if (!checkedIn) console.log(`      → ${JSON.stringify(checkIn.body)}`);

    const activeRes = await api('GET', '/api/sessions/me/active', memberToken);
    log('GET /api/sessions/me/active (minuteur live) — 200', activeRes.status === 200);
    if (activeRes.body?.session) {
      console.log(`      → session active, temps_restant=${activeRes.body.session.temps_restant} min`);
    }

    const checkOut = await api('POST', '/api/sessions/check-out', memberToken, {
      reservation_id: bookingId,
    });
    log('POST /api/sessions/check-out — 200', checkOut.status === 200 && checkOut.body?.session);
    console.log(`      → statut final=${checkOut.body?.session?.statut} ${checkOut.body?.overtime ? '(dépassement)' : ''}`);

    // Nettoyage : annulation admin (staff contourne la politique)
    const cancelAdmin = await api('DELETE', `/api/bookings/${bookingId}`, adminToken);
    log('DELETE /api/bookings/:id (nettoyage admin) — 200', cancelAdmin.status === 200);
  }

  // Annulation membre sur créneau J+2 (respect politique > 24 h)
  const cancelFrom = isoAddDays(2);
  const cancelCreate = await api('POST', '/api/bookings', memberToken, {
    espace_id: espace.id,
    date_debut: cancelFrom,
    date_fin: new Date(new Date(cancelFrom).getTime() + 2 * 3600000).toISOString(),
    mode: 'online',
  });
  if (cancelCreate.status === 201) {
    const cancelBookingId = cancelCreate.body.reservation.id;
    const cancelMember = await api('DELETE', `/api/bookings/${cancelBookingId}`, memberToken);
    log('DELETE /api/bookings/:id (annulation membre J+2) — 200', cancelMember.status === 200);
    if (cancelMember.status === 200) {
      console.log(`      → ${cancelMember.body.message} (pénalité ${cancelMember.body.penalite_pct}%)`);
    } else {
      console.log(`      → ${JSON.stringify(cancelMember.body)}`);
    }
  } else {
    log('Création réservation J+2 pour test annulation', false);
    console.log(`      → ${JSON.stringify(cancelCreate.body)}`);
  }

  // Nettoyage de l'abonnement créé pour le test
  if (subId) {
    const { error: delSubErr } = await supabase.from('abonnements').update({ statut: 'suspended' }).eq('id', subId);
    log('Nettoyage abonnement test (désactivé)', !delSubErr);
  }

  // ─── Module E — Portail Membre ───────────────────────────────────────
  logSection('🅴  Module E — Portail Membre');

  const history = await api('GET', '/api/bookings/history', memberToken);
  log('GET /api/bookings/history — 200', history.status === 200 && Array.isArray(history.body?.bookings));
  console.log(`      → stats: ${history.body?.stats?.total} réservation(s), ${history.body?.stats?.totalHours} h`);

  const stats = await api('GET', '/api/member/stats', memberToken);
  log('GET /api/member/stats — 200', stats.status === 200);

  const notifs = await api('GET', '/api/member/notifications', memberToken);
  log('GET /api/member/notifications — 200', notifs.status === 200);
  console.log(`      → ${(notifs.body?.notifications || []).length} notification(s), ${notifs.body?.unreadCount} non lue(s)`);

  const qr = await api('GET', '/api/members/me/qr', memberToken);
  log('GET /api/members/me/qr — 200', qr.status === 200);

  const readAll = await api('POST', '/api/member/notifications/read-all', memberToken);
  log('POST /api/member/notifications/read-all — 200', readAll.status === 200);

  // ─── Synthèse ────────────────────────────────────────────────────────
  logSection(`📊  SYNTHÈSE — ${passed} PASS · ${failed} FAIL`);
  if (failures.length) {
    console.log('\nÉchecs :');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Erreur globale :', err);
  process.exit(1);
});
