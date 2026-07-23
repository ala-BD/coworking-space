/**
 * testKPIs.js — Test des routes API Module D (KPIs & Dashboard)
 * ─────────────────────────────────────────────────────────────
 * Usage :
 *   1. Démarrer le serveur : node backend/server.js
 *   2. Mettre un token JWT admin valide dans TOKEN ci-dessous
 *   3. Exécuter : node backend/test/testKPIs.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';

// ⚠️  Remplacer par un token JWT valide d'un compte admin/staff
const TOKEN = process.env.JWT_TOKEN || 'VOTRE_TOKEN_JWT_ICI';

// ─── Helpers ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function log(msg, ok = true) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon}  ${msg}`);
  if (ok) passed++; else failed++;
}

function logSection(title) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  📊  ${title}`);
  console.log('─'.repeat(55));
}

async function fetchKPI(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Tests ──────────────────────────────────────────────────────────────────
async function testKpisMain() {
  logSection('GET /api/admin/kpis — KPIs principaux');

  const { status, body } = await fetchKPI('/api/admin/kpis');

  log(`Statut HTTP 200`, status === 200);

  if (status !== 200) {
    log(`Erreur : ${body.error || JSON.stringify(body)}`, false);
    return;
  }

  // Champs obligatoires
  const requiredFields = [
    'membresActifs', 'nouveauxMembres', 'chiffreAffaires',
    'tauxOccupation', 'sessionsEnCours', 'paiementsEnAttente',
    'abonnementsExpirant', 'reservationsDuJour', 'formationsDuJour',
    'topMembres', 'generatedAt',
  ];
  for (const field of requiredFields) {
    log(`Champ "${field}" présent`, field in body);
  }

  // Sous-champs chiffreAffaires
  const ca = body.chiffreAffaires;
  log('chiffreAffaires.jour est un nombre',   typeof ca?.jour === 'number');
  log('chiffreAffaires.mois est un nombre',   typeof ca?.mois === 'number');
  log('chiffreAffaires.annee est un nombre',  typeof ca?.annee === 'number');

  // Sous-champs nouveauxMembres
  const nm = body.nouveauxMembres;
  log('nouveauxMembres.moisActuel présent',   nm?.moisActuel != null);
  log('nouveauxMembres.evolution est calculé', nm?.evolution != null);

  // Tableaux
  log('tauxOccupation est un tableau',  Array.isArray(body.tauxOccupation));
  log('sessionsEnCours est un tableau', Array.isArray(body.sessionsEnCours));
  log('topMembres est un tableau',      Array.isArray(body.topMembres));
  log('topMembres <= 5 éléments',       body.topMembres.length <= 5);

  // paiementsEnAttente
  const pa = body.paiementsEnAttente;
  log('paiementsEnAttente.count présent',       pa?.count != null);
  log('paiementsEnAttente.montantTotal présent', pa?.montantTotal != null);

  // Vérification structure sessionsEnCours si non vide
  if (body.sessionsEnCours.length > 0) {
    const s = body.sessionsEnCours[0];
    log('Session a un champ "membre"',     'membre'      in s);
    log('Session a un champ "espace"',     'espace'      in s);
    log('Session a un champ "tempsRestant"', 'tempsRestant' in s);
  } else {
    log('sessionsEnCours vide (aucune session active)', true);
  }

  console.log('\n  📋  Aperçu des données :');
  console.log(`     · Membres actifs     : ${body.membresActifs}`);
  console.log(`     · Nouveaux ce mois   : ${body.nouveauxMembres.moisActuel} (évolution : ${body.nouveauxMembres.evolution}%)`);
  console.log(`     · CA du mois         : ${body.chiffreAffaires.mois} DT`);
  console.log(`     · CA annuel          : ${body.chiffreAffaires.annee} DT`);
  console.log(`     · Sessions en cours  : ${body.sessionsEnCours.length}`);
  console.log(`     · Impayés (montant)  : ${body.paiementsEnAttente.montantTotal} DT`);
  console.log(`     · Abonnements J-7    : ${body.abonnementsExpirant}`);
  console.log(`     · Réservations/jour  : ${body.reservationsDuJour}`);
  console.log(`     · Top membres        : ${body.topMembres.length} entrées`);
}

async function testRevenueChart() {
  logSection('GET /api/admin/kpis/revenue-chart — Graphiques 6 mois');

  const { status, body } = await fetchKPI('/api/admin/kpis/revenue-chart');

  log(`Statut HTTP 200`, status === 200);

  if (status !== 200) {
    log(`Erreur : ${body.error || JSON.stringify(body)}`, false);
    return;
  }

  log('Champ "revenueChart" présent',    Array.isArray(body.revenueChart));
  log('Champ "occupationChart" présent', Array.isArray(body.occupationChart));
  log('revenueChart a 6 entrées',        body.revenueChart.length === 6);
  log('occupationChart a 6 entrées',     body.occupationChart.length === 6);

  if (body.revenueChart.length > 0) {
    const m = body.revenueChart[0];
    log('Entrée revenueChart a "mois"',         'mois'         in m);
    log('Entrée revenueChart a "ca"',           'ca'           in m);
    log('Entrée revenueChart a "transactions"', 'transactions' in m);
    log('"ca" est un nombre',                   typeof m.ca === 'number');
  }

  if (body.occupationChart.length > 0) {
    const o = body.occupationChart[0];
    log('Entrée occupationChart a "mois"', 'mois' in o);
    log('Entrée occupationChart a "taux"', 'taux' in o);
    log('"taux" entre 0 et 100',           o.taux >= 0 && o.taux <= 100);
  }

  console.log('\n  📈  Évolution CA :');
  body.revenueChart.forEach((m) => {
    console.log(`     · ${m.mois.padEnd(8)} : ${String(m.ca).padStart(10)} DT  (${m.transactions} transaction(s))`);
  });
}

async function testUnauthorized() {
  logSection('Test sécurité — accès sans token');

  const res = await fetch(`${API_URL}/api/admin/kpis`);
  const body = await res.json();
  log('Statut 401 sans token',  res.status === 401);
  log('Message d\'erreur présent', !!body.error);
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   MODULE D — Test API KPIs & Dashboard             ║');
  console.log('║   Coworking Space — VC LOW                          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  🌐  API : ${API_URL}`);
  console.log(`  🔑  Token : ${TOKEN === 'VOTRE_TOKEN_JWT_ICI' ? '⚠️  Non configuré !' : TOKEN.slice(0, 30) + '…'}`);

  if (TOKEN === 'VOTRE_TOKEN_JWT_ICI') {
    console.log('\n  ⚠️  ATTENTION : Configurez le TOKEN JWT avant de lancer les tests.');
    console.log('  Définissez la variable JWT_TOKEN ou modifiez la constante TOKEN dans ce fichier.\n');
    process.exit(1);
  }

  try {
    await testUnauthorized();
    await testKpisMain();
    await testRevenueChart();
  } catch (err) {
    console.error('\n  💥  Erreur inattendue :', err.message);
    failed++;
  }

  console.log('\n' + '═'.repeat(55));
  console.log(`  Résultats : ${passed} ✅  /  ${failed} ❌  /  ${passed + failed} total`);
  console.log('═'.repeat(55) + '\n');

  if (failed > 0) process.exit(1);
}

run();
