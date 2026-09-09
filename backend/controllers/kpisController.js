// controllers/kpisController.js — MODULE D : KPIs & Dashboard Admin
const { supabaseAdmin } = require('../config/supabase');
const { computeRemainingMinutes } = require('../models/helpers');

// ─── Fenêtres de période (Jour / Mois / Année / Tout) ───────────────────────
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
  return {
    period,
    from: fromJ.toISOString(),
    to: toJ.toISOString(),
    fromJ,
    toJ,
    ms: toJ.getTime() - fromJ.getTime(),
    bucket,
  };
}

function previousWindow(win) {
  const dur = (win.toJ.getTime() - win.fromJ.getTime()) + 1;
  const toJ = new Date(win.fromJ.getTime() - 1);
  const fromJ = new Date(toJ.getTime() - dur + 1);
  return {
    from: fromJ.toISOString(),
    to: toJ.toISOString(),
    fromJ,
    toJ,
  };
}

function pctChange(cur, prev) {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return cur > 0 ? 100 : 0;
}

function sumMt(items) {
  return (items || []).reduce((s, p) => s + parseFloat(p.montant || 0), 0);
}

function buildBuckets(win) {
  const out = [];
  const start = win.fromJ;
  if (win.bucket === 'hour') {
    for (let h = 0; h < 24; h++) {
      const bStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h, 0, 0, 0);
      const bEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h, 59, 59, 999);
      out.push({ label: `${String(h).padStart(2, '0')}h`, start: bStart, end: bEnd });
    }
  } else if (win.bucket === 'day') {
    const y = start.getFullYear();
    const m = start.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const bStart = new Date(y, m, d, 0, 0, 0, 0);
      const bEnd = new Date(y, m, d, 23, 59, 59, 999);
      out.push({ label: String(d), start: bStart, end: bEnd });
    }
  } else if (win.bucket === 'month') {
    const y = start.getFullYear();
    for (let i = 0; i < 12; i++) {
      const bStart = new Date(y, i, 1);
      const bEnd = new Date(y, i + 1, 0, 23, 59, 59, 999);
      out.push({ label: bStart.toLocaleDateString('fr-FR', { month: 'short' }), start: bStart, end: bEnd });
    }
  } else {
    const y0 = start.getFullYear();
    const y1 = win.toJ.getFullYear();
    for (let yr = y0; yr <= y1; yr++) {
      const bStart = new Date(yr, 0, 1);
      const bEnd = new Date(yr, 11, 31, 23, 59, 59, 999);
      out.push({ label: String(yr), start: bStart, end: bEnd });
    }
  }
  return out;
}

function inBucket(date, b) {
  return date >= b.start && date <= b.end;
}

// GET /api/admin/kpis?period=jour|mois|annee|tout
async function getAdminKpis(req, res) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tid = req.tenantId;
    const period = String(req.query.period || 'mois');
    const win = getPeriodWindow(period, today);
    const prev = previousWindow(win);

    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const debutMoisPrecedent = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const finMoisPrecedent = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString();
    const debutAnnee = new Date(today.getFullYear(), 0, 1).toISOString();
    const debutJour = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const finJour = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    // ── Membres actifs (instantané) ─────────────────────────────────────
    let membQ = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('statut_compte', 'actif')
      .eq('role', 'member');
    if (tid) membQ = membQ.eq('tenant_id', tid);
    const { count: membresActifs } = await membQ;

    // ── Nouveaux membres (historique mensuel + période) ─────────────────
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

    let nP1Q = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', win.from)
      .lte('created_at', win.to);
    if (tid) nP1Q = nP1Q.eq('tenant_id', tid);
    const { count: nouveauxPeriode } = await nP1Q;

    let nP2Q = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', prev.from)
      .lte('created_at', prev.to);
    if (tid) nP2Q = nP2Q.eq('tenant_id', tid);
    const { count: nouveauxPeriodePrec } = await nP2Q;

    // ── CA (jour / mois / année / période) ───────────────────────────────
    let pjQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutJour).lte('date_paiement', finJour);
    if (tid) pjQ = pjQ.eq('tenant_id', tid);
    const { data: paieJour } = await pjQ;

    let pmQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutMois);
    if (tid) pmQ = pmQ.eq('tenant_id', tid);
    const { data: paieMois } = await pmQ;

    let paQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', debutAnnee);
    if (tid) paQ = paQ.eq('tenant_id', tid);
    const { data: paieAnnee } = await paQ;

    let ppQ = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', win.from).lte('date_paiement', win.to);
    if (tid) ppQ = ppQ.eq('tenant_id', tid);
    const { data: paiePeriode } = await ppQ;

    let ppQf = supabaseAdmin.from('paiements').select('montant').eq('statut', 'paid').gte('date_paiement', prev.from).lte('date_paiement', prev.to);
    if (tid) ppQf = ppQf.eq('tenant_id', tid);
    const { data: paiePeriodePrec } = await ppQf;

    const caJour = sumMt(paieJour);
    const caMois = sumMt(paieMois);
    const caAnnee = sumMt(paieAnnee);
    const caPeriode = sumMt(paiePeriode);
    const caPeriodePrec = sumMt(paiePeriodePrec);

    // ── Espaces & réservations dans la période ───────────────────────────
    let espQ = supabaseAdmin.from('espaces').select('id, nom, type');
    if (tid) espQ = espQ.eq('tenant_id', tid);
    const { data: espaces } = await espQ;

    let resvQ = supabaseAdmin
      .from('reservations')
      .select('espace_id, date_debut, date_fin, statut')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', win.from)
      .lte('date_debut', win.to);
    if (tid) resvQ = resvQ.eq('tenant_id', tid);
    const { data: reservationsPeriodeArr } = await resvQ;

    const periodMs = Math.max(1, win.ms);
    const tauxOccupation = (espaces || []).map((espace) => {
      const resEspace = (reservationsPeriodeArr || []).filter((r) => r.espace_id === espace.id);
      const reservedMs = resEspace.reduce((acc, r) => {
        return acc + (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime());
      }, 0);
      const taux = Math.min(100, Math.round((reservedMs / periodMs) * 100));
      return { nom: espace.nom, type: espace.type, taux: reservedMs > 0 ? taux : 0 };
    });

    const occupationMoyen = (espaces || []).length > 0
      ? Math.round((tauxOccupation || []).reduce((s, e) => s + ((e && e.taux) || 0), 0) / (espaces || []).length)
      : 0;

    const reservationsPeriode = {
      count: (reservationsPeriodeArr || []).length,
      confirmed: (reservationsPeriodeArr || []).filter((r) => r.statut === 'confirmed').length,
      pending: (reservationsPeriodeArr || []).filter((r) => r.statut === 'pending').length,
    };

    // ── Sessions en cours (instantané live) ───────────────────────────────
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

    // ── Paiements en attente dans la période ──────────────────────────────
    let peaQ = supabaseAdmin.from('paiements').select('montant, created_at').eq('statut', 'pending').gte('created_at', win.from).lte('created_at', win.to);
    if (tid) peaQ = peaQ.eq('tenant_id', tid);
    const { data: paiementsEnAttente } = await peaQ;
    const montantEnAttente = sumMt(paiementsEnAttente);

    // ── Abonnements expirant (instantané, J+7) ─────────────────────────────
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

    // ── Réservations du jour (instantané) ──────────────────────────────────
    const debutJourStr = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const finJourStr = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    let resvJQ = supabaseAdmin
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', debutJourStr)
      .lte('date_debut', finJourStr);
    if (tid) resvJQ = resvJQ.eq('tenant_id', tid);
    const { count: reservationsDuJour } = await resvJQ;

    // ── Formations : du jour (instantané) + période ────────────────────────
    let formationsDuJour = 0;
    let formationsPeriode = 0;
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

      let fpQ = supabaseAdmin
        .from('formations')
        .select('*', { count: 'exact', head: true })
        .in('statut', ['planifiee', 'en_cours'])
        .gte('date_debut', win.from)
        .lte('date_debut', win.to);
      if (tid) fpQ = fpQ.eq('tenant_id', tid);
      const { count: fp } = await fpQ;
      formationsPeriode = fp || 0;
    } catch (_) {
      formationsDuJour = 0;
      formationsPeriode = 0;
    }

    // ── Top membres par CA dans la période ─────────────────────────────────
    let topPQ = supabaseAdmin
      .from('paiements')
      .select('user_id, montant, profiles(nom, prenom, email)')
      .eq('statut', 'paid')
      .gte('date_paiement', win.from)
      .lte('date_paiement', win.to);
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

    // ── CA du mois précédent (comparaison mensuelle) ────────────────────────
    let pmpQ = supabaseAdmin
      .from('paiements').select('montant').eq('statut', 'paid')
      .gte('date_paiement', debutMoisPrecedent).lte('date_paiement', finMoisPrecedent);
    if (tid) pmpQ = pmpQ.eq('tenant_id', tid);
    const { data: paieMoisPrec } = await pmpQ;
    const caMoisPrecedent = Math.round(sumMt(paieMoisPrec) * 100) / 100;

    // ── Calendrier du jour : toutes les réservations d'aujourd'hui ─────────
    let calQ = supabaseAdmin
      .from('reservations')
      .select('id, date_debut, date_fin, statut, espaces(nom, type), profiles(nom, prenom)')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', debutJourStr)
      .lte('date_debut', finJourStr)
      .order('date_debut', { ascending: true });
    if (tid) calQ = calQ.eq('tenant_id', tid);
    const { data: calendrierDuJourArr } = await calQ;

    // ── Prochaines réservations (J+7, à partir de maintenant) ───────────────
    const dans7JoursFin = new Date();
    dans7JoursFin.setDate(dans7JoursFin.getDate() + 7);
    let nextQ = supabaseAdmin
      .from('reservations')
      .select('id, date_debut, date_fin, statut, espaces(nom), profiles(nom, prenom)')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', new Date().toISOString())
      .lte('date_debut', dans7JoursFin.toISOString())
      .order('date_debut', { ascending: true })
      .limit(6);
    if (tid) nextQ = nextQ.eq('tenant_id', tid);
    const { data: prochainesReservationsArr } = await nextQ;

    // ── Formations du jour : liste détaillée ────────────────────────────────
    let fdjListQ = supabaseAdmin
      .from('formations')
      .select('id, titre, date_debut, date_fin, nb_inscrits, capacite_max, statut, prix_inscription, espaces(nom), profiles(nom, prenom, specialite)')
      .in('statut', ['planifiee', 'en_cours'])
      .gte('date_debut', debutJourStr)
      .lte('date_debut', finJourStr)
      .order('date_debut', { ascending: true });
    if (tid) fdjListQ = fdjListQ.eq('tenant_id', tid);
    const { data: formationsDuJourList } = await fdjListQ;

    // ── Activité récente : réservations + paiements + check-ins ────────────
    const feed = [];
    let actResQ = supabaseAdmin
      .from('reservations')
      .select('id, created_at, statut, espaces(nom), profiles(nom, prenom)')
      .in('statut', ['confirmed', 'pending'])
      .order('created_at', { ascending: false })
      .limit(6);
    if (tid) actResQ = actResQ.eq('tenant_id', tid);
    const { data: actRes } = await actResQ;
    (actRes || []).forEach((r) => {
      const who = r.profiles ? `${r.profiles.prenom} ${r.profiles.nom}` : 'Un membre';
      feed.push({
        id: `r-${r.id}`,
        type: 'reservation',
        text: `${who} a réservé ${r.espaces?.nom || 'un espace'}`,
        time: r.created_at,
      });
    });

    let actPaieQ = supabaseAdmin
      .from('paiements')
      .select('id, created_at, montant, profiles(nom, prenom)')
      .eq('statut', 'paid')
      .order('created_at', { ascending: false })
      .limit(6);
    if (tid) actPaieQ = actPaieQ.eq('tenant_id', tid);
    const { data: actPaie } = await actPaieQ;
    (actPaie || []).forEach((p) => {
      const who = p.profiles ? `${p.profiles.prenom} ${p.profiles.nom}` : 'Un membre';
      feed.push({
        id: `p-${p.id}`,
        type: 'paiement',
        text: `Paiement de ${parseFloat(p.montant || 0).toFixed(2)} DT reçu — ${who}`,
        time: p.created_at,
      });
    });

    let actSessQ = supabaseAdmin
      .from('sessions')
      .select('id, check_in, reservations(espaces(nom), profiles(nom, prenom))')
      .not('check_in', 'is', null)
      .order('check_in', { ascending: false })
      .limit(6);
    if (tid) actSessQ = actSessQ.eq('tenant_id', tid);
    const { data: actSess } = await actSessQ;
    (actSess || []).forEach((s) => {
      const who = s.reservations?.profiles ? `${s.reservations.profiles.prenom} ${s.reservations.profiles.nom}` : 'Un membre';
      feed.push({
        id: `s-${s.id}`,
        type: 'session',
        text: `Check-in : ${who} (${s.reservations?.espaces?.nom || 'espace'})`,
        time: s.check_in,
      });
    });

    const activiteRecente = feed
      .filter((e) => e.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);

    res.json({
      membresActifs: membresActifs || 0,
      nouveauxMembres: {
        moisActuel: nouveauxMoisActuel || 0,
        moisPrecedent: nouveauxMoisPrecedent || 0,
        evolution: pctChange(nouveauxMoisActuel, nouveauxMoisPrecedent),
        periode: nouveauxPeriode || 0,
        periodePrecedente: nouveauxPeriodePrec || 0,
        evolutionPeriode: pctChange(nouveauxPeriode, nouveauxPeriodePrec),
      },
      chiffreAffaires: {
        jour: Math.round(caJour * 100) / 100,
        mois: Math.round(caMois * 100) / 100,
        annee: Math.round(caAnnee * 100) / 100,
        periode: Math.round(caPeriode * 100) / 100,
        periodePrecedente: Math.round(caPeriodePrec * 100) / 100,
        transactions: (paiePeriode || []).length,
        evolution: pctChange(caPeriode, caPeriodePrec),
      },
      tauxOccupation,
      occupationMoyen,
      sessionsEnCours,
      paiementsEnAttente: {
        count: (paiementsEnAttente || []).length,
        montantTotal: Math.round(montantEnAttente * 100) / 100,
      },
      abonnementsExpirant: abonnementsExpirant || 0,
      reservationsDuJour: reservationsDuJour || 0,
      reservationsPeriode,
      formationsDuJour,
      formationsPeriode,
      topMembres,
      caMoisPrecedent,
      calendrierDuJour: calendrierDuJourArr || [],
      prochainesReservations: prochainesReservationsArr || [],
      formationsDuJourList: formationsDuJourList || [],
      activiteRecente: activiteRecente || [],
      periode: { key: period, from: win.from, to: win.to, bucket: win.bucket },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur KPIs:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/kpis/revenue-chart?period=jour|mois|annee|tout
async function getRevenueChart(req, res) {
  try {
    const now = new Date();
    const tid = req.tenantId;
    const period = String(req.query.period || 'mois');
    const win = getPeriodWindow(period, now);

    const buckets = buildBuckets(win);
    const W_FROM = buckets[0].start.toISOString();
    const W_TO = buckets[buckets.length - 1].end.toISOString();

    // ── Paiements paid (CA + transactions + par espace) ───────────────────
    let paieQ = supabaseAdmin
      .from('paiements')
      .select('montant, date_paiement, reservations(espaces(nom))')
      .eq('statut', 'paid')
      .gte('date_paiement', W_FROM)
      .lte('date_paiement', W_TO);
    if (tid) paieQ = paieQ.eq('tenant_id', tid);
    const { data: paiements } = await paieQ;

    const revenueChart = buckets.map((b) => {
      const arr = (paiements || []).filter((p) => p.date_paiement && inBucket(new Date(p.date_paiement), b));
      const ca = arr.reduce((s, p) => s + parseFloat(p.montant || 0), 0);
      return {
        mois: b.label,
        ca: Math.round(ca * 100) / 100,
        transactions: arr.length,
      };
    });

    const caMap = {};
    (paiements || []).forEach((p) => {
      const nom = p.reservations?.espaces?.nom;
      const key = nom || 'Espace général';
      caMap[key] = (caMap[key] || 0) + parseFloat(p.montant || 0);
    });
    const caParEspace = Object.entries(caMap)
      .map(([nom, ca]) => ({ nom, ca: Math.round(ca * 100) / 100 }))
      .sort((a, b) => b.ca - a.ca);

    // ── Réservations (occupation + répartition par espace) ─────────────────
    let resvAllQ = supabaseAdmin
      .from('reservations')
      .select('espace_id, date_debut, date_fin, statut, espaces(nom)')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', W_FROM)
      .lte('date_debut', W_TO);
    if (tid) resvAllQ = resvAllQ.eq('tenant_id', tid);
    const { data: reservationsAll } = await resvAllQ;

    let espChartQ = supabaseAdmin.from('espaces').select('id, nom');
    if (tid) espChartQ = espChartQ.eq('tenant_id', tid);
    const { data: espaces } = await espChartQ;

    const occupationChart = buckets.map((b) => {
      const moisRes = (reservationsAll || []).filter((r) => inBucket(new Date(r.date_debut), b));
      const bucketMs = Math.max(1, b.end.getTime() - b.start.getTime());
      const tauxMoyen = (espaces || []).length > 0
        ? Math.round(
          (espaces || []).reduce((acc, esp) => {
            const espRes = moisRes.filter((r) => r.espace_id === esp.id);
            const ms = espRes.reduce((s, r) =>
              s + Math.max(0, (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime())), 0);
            return acc + (bucketMs > 0 ? Math.min(100, (ms / bucketMs) * 100) : 0);
          }, 0) / (espaces || []).length
        )
        : 0;
      return { mois: b.label, taux: tauxMoyen };
    });

    const resSpaceMap = {};
    (reservationsAll || []).forEach((r) => {
      const nom = r.espaces?.nom || 'Espace général';
      if (!resSpaceMap[nom]) resSpaceMap[nom] = { confirmed: 0, pending: 0 };
      if (r.statut === 'confirmed') resSpaceMap[nom].confirmed += 1;
      else resSpaceMap[nom].pending += 1;
    });
    const reservationsParEspace = Object.entries(resSpaceMap).map(([nom, v]) => ({ nom, ...v }));

    // ── Formations programmées dans la période (liste détaillée) ────────────
    let formQ = supabaseAdmin
      .from('formations')
      .select('id, titre, date_debut, date_fin, nb_inscrits, capacite_max, statut, prix_inscription, espaces(nom), profiles(nom, prenom, specialite)')
      .in('statut', ['planifiee', 'en_cours'])
      .gte('date_debut', W_FROM)
      .lte('date_debut', W_TO)
      .order('date_debut', { ascending: true });
    if (tid) formQ = formQ.eq('tenant_id', tid);
    const { data: formationsList } = await formQ;

    res.json({
      revenueChart,
      occupationChart,
      caParEspace,
      reservationsParEspace,
      formations: formationsList || [],
      periode: { key: win.period, from: win.from, to: win.to, bucket: win.bucket },
    });
  } catch (err) {
    console.error('Erreur revenue-chart:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAdminKpis,
  getRevenueChart,
  getPeriodWindow,
  previousWindow,
  pctChange,
  sumMt,
  buildBuckets,
  inBucket,
};