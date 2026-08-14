// controllers/kpisController.js — MODULE D : KPIs & Dashboard Admin
const { supabaseAdmin } = require('../config/supabase');
const { computeRemainingMinutes } = require('../models/helpers');

async function getAdminKpis(req, res) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tid = req.tenantId;

    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const debutMoisPrecedent = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const finMoisPrecedent = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString();
    const debutAnnee = new Date(today.getFullYear(), 0, 1).toISOString();
    const debutJour = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const finJour = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    let membQ = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('statut_compte', 'actif')
      .eq('role', 'member');
    if (tid) membQ = membQ.eq('tenant_id', tid);
    const { count: membresActifs } = await membQ;

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

    let peaQ = supabaseAdmin.from('paiements').select('montant, created_at').eq('statut', 'pending');
    if (tid) peaQ = peaQ.eq('tenant_id', tid);
    const { data: paiementsEnAttente } = await peaQ;

    const montantEnAttente = (paiementsEnAttente || [])
      .reduce((s, p) => s + parseFloat(p.montant || 0), 0);

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
}

async function getRevenueChart(req, res) {
  try {
    const months = [];
    const now = new Date();
    const tid = req.tenantId;

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
}

module.exports = {
  getAdminKpis,
  getRevenueChart,
};
