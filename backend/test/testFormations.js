/**
 * testFormations.js — Tests API Module G (Formateurs & Formations)
 * ─────────────────────────────────────────────────────────────────
 * Usage :
 *   JWT_TOKEN=<token_admin> node backend/test/testFormations.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TOKEN   = process.env.JWT_TOKEN || 'VOTRE_TOKEN_JWT_ICI';

let passed = 0; let failed = 0;
let createdFormationId = null;

function log(msg, ok = true) {
  console.log(`  ${ok ? '✅' : '❌'}  ${msg}`);
  if (ok) passed++; else failed++;
}
function logSection(title) {
  console.log(`\n${'─'.repeat(58)}\n  📋  ${title}\n${'─'.repeat(58)}`);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

// ─── Tests Formateurs ────────────────────────────────────────────────────────
async function testGetFormateurs() {
  logSection('GET /api/formateurs — Liste des formateurs');
  const { status, body } = await api('GET', '/api/formateurs');
  log(`Statut HTTP 200`, status === 200);
  log(`Champ "formateurs" présent`, Array.isArray(body.formateurs));
  if (body.formateurs?.length > 0) {
    const f = body.formateurs[0];
    log('Formateur a id, nom, prenom', 'id' in f && 'nom' in f && 'prenom' in f);
    log('Formateur a specialite',      'specialite' in f);
    console.log(`     · ${body.formateurs.length} formateur(s) trouvé(s)`);
  } else {
    log('Aucun formateur (table vide — normal si pas de données)', true);
  }
}

// ─── Tests Formations ────────────────────────────────────────────────────────
async function testGetFormations() {
  logSection('GET /api/formations — Catalogue');
  const { status, body } = await api('GET', '/api/formations');
  log(`Statut HTTP 200`, status === 200);
  log(`Champ "formations" présent`, Array.isArray(body.formations));
  if (body.formations?.length > 0) {
    const f = body.formations[0];
    log('Formation a titre',           'titre'           in f);
    log('Formation a date_debut',      'date_debut'      in f);
    log('Formation a capacite_max',    'capacite_max'    in f);
    log('Formation a nb_inscrits',     'nb_inscrits'     in f);
    log('Formation a places_restantes','places_restantes' in f);
    console.log(`     · ${body.formations.length} formation(s) trouvée(s)`);
  } else {
    log('Aucune formation (table vide — normal si pas de données)', true);
  }
}

async function testCreateFormation(formateurId) {
  if (!formateurId) {
    logSection('POST /api/formations — Création (IGNORÉ — pas de formateur)');
    log('Test ignoré : aucun formateur disponible', true);
    return;
  }

  logSection('POST /api/formations — Création');
  const debut = new Date(Date.now() + 7 * 86400000).toISOString();
  const fin   = new Date(Date.now() + 7 * 86400000 + 3 * 3600000).toISOString();

  const { status, body } = await api('POST', '/api/formations', {
    titre: 'Test Formation Module G',
    description: 'Formation de test créée par testFormations.js',
    formateur_id: formateurId,
    date_debut: debut,
    date_fin: fin,
    capacite_max: 10,
    prix_inscription: 0,
    statut: 'planifiee',
  });

  log(`Statut HTTP 201`, status === 201);
  log(`Champ "formation" présent`, !!body.formation);
  if (body.formation) {
    createdFormationId = body.formation.id;
    log('Formation a un id UUID',    !!body.formation.id);
    log('Titre correct',             body.formation.titre === 'Test Formation Module G');
    log('Statut = planifiee',        body.formation.statut === 'planifiee');
    log('capacite_max = 10',         body.formation.capacite_max === 10);
    console.log(`     · Formation créée : ${createdFormationId}`);
  }
}

async function testGetFormationById() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id — Détail (IGNORÉ)');
    log('Test ignoré : aucune formation créée', true);
    return;
  }

  logSection(`GET /api/formations/${createdFormationId} — Détail`);
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}`);
  log(`Statut HTTP 200`,                status === 200);
  log(`Champ "formation" présent`,      !!body.formation);
  log(`Champ "participants" présent`,   Array.isArray(body.participants));
  log(`nb_inscrits = 0`,               body.formation?.nb_inscrits === 0);
  log(`places_restantes = capacite`,   body.formation?.places_restantes === body.formation?.capacite_max);
}

async function testInscription() {
  if (!createdFormationId) {
    logSection('POST /api/formations/:id/inscriptions (IGNORÉ)');
    log('Test ignoré', true);
    return;
  }

  logSection('POST /api/formations/:id/inscriptions — Inscription');
  const { status, body } = await api('POST', `/api/formations/${createdFormationId}/inscriptions`);
  log(`Statut 201 ou 409 (déjà inscrit)`, status === 201 || status === 409);
  if (status === 201) {
    log('Inscription présente',           !!body.inscription);
    log('Statut = confirmee ou en_attente',
      ['confirmee', 'en_attente'].includes(body.inscription?.statut));
    console.log(`     · ${body.message}`);
  } else if (status === 409) {
    log('Message doublon reçu',          !!body.error);
  }
}

async function testParticipants() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id/inscriptions (IGNORÉ)');
    log('Test ignoré', true);
    return;
  }

  logSection('GET /api/formations/:id/inscriptions — Participants');
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}/inscriptions`);
  log(`Statut HTTP 200`,               status === 200);
  log(`Champ "participants" présent`,  Array.isArray(body.participants));
  log(`Champ "liste_attente" présent`, Array.isArray(body.liste_attente));
  console.log(`     · ${body.participants?.length || 0} participant(s)`);
}

async function testEmargement() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id/emargement (IGNORÉ)');
    log('Test ignoré', true);
    return;
  }

  logSection('GET /api/formations/:id/emargement — Émargement');
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}/emargement`);
  log(`Statut HTTP 200`,               status === 200);
  log(`Champ "formation" présent`,     !!body.formation);
  log(`Champ "participants" présent`,  Array.isArray(body.participants));
  if (body.formation) {
    log('formation.titre présent',     !!body.formation.titre);
    log('formation.date présent',      !!body.formation.date);
    log('formation.formateur présent', !!body.formation.formateur);
  }
}

async function testPatchFormation() {
  if (!createdFormationId) return;

  logSection('PATCH /api/formations/:id — Modification');
  const { status, body } = await api('PATCH', `/api/formations/${createdFormationId}`, {
    titre: 'Test Formation Module G — MODIFIÉE',
    capacite_max: 15,
  });
  log(`Statut HTTP 200`,                          status === 200);
  log(`Titre mis à jour`,                         body.formation?.titre === 'Test Formation Module G — MODIFIÉE');
  log(`capacite_max mis à jour`,                  body.formation?.capacite_max === 15);
}

async function testMesFormations() {
  logSection('GET /api/members/me/formations — Mes formations');
  const { status, body } = await api('GET', '/api/members/me/formations');
  log(`Statut HTTP 200`,               status === 200);
  log(`Champ "inscriptions" présent`,  Array.isArray(body.inscriptions));
  console.log(`     · ${body.inscriptions?.length || 0} inscription(s) trouvée(s)`);
}

async function testDeleteFormation() {
  if (!createdFormationId) return;

  logSection('DELETE /api/formations/:id — Suppression/Annulation');
  const { status, body } = await api('DELETE', `/api/formations/${createdFormationId}`);
  log(`Statut HTTP 200`, status === 200);
  log(`Message reçu`,    !!body.message);
  console.log(`     · ${body.message}`);
}

async function testSecurity() {
  logSection('Sécurité — Accès sans token');
  const res = await fetch(`${API_URL}/api/formations`);
  const body = await res.json().catch(() => ({}));
  log('Statut 401 sans token',  res.status === 401);
  log('Message erreur présent', !!body.error);
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MODULE G — Test API Formateurs & Formations           ║');
  console.log('║   Coworking Space — VC LOW                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  🌐  API : ${API_URL}`);

  if (TOKEN === 'VOTRE_TOKEN_JWT_ICI') {
    console.log('\n  ⚠️  TOKEN JWT non configuré. Définissez JWT_TOKEN=<token>.\n');
    process.exit(1);
  }

  try {
    await testSecurity();
    await testGetFormateurs();

    // Récupérer un formateur pour les tests de création
    const { body: fBody } = await api('GET', '/api/formateurs');
    const formateurId = fBody.formateurs?.[0]?.id || null;
    if (!formateurId) console.log('\n  ℹ️  Aucun formateur en DB — tests de création ignorés.');

    await testGetFormations();
    await testCreateFormation(formateurId);
    await testGetFormationById();
    await testInscription();
    await testParticipants();
    await testEmargement();
    await testPatchFormation();
    await testMesFormations();
    await testDeleteFormation();
  } catch (err) {
    console.error('\n  💥  Erreur inattendue :', err.message);
    failed++;
  }

  console.log('\n' + '═'.repeat(58));
  console.log(`  Résultats : ${passed} ✅  /  ${failed} ❌  /  ${passed + failed} total`);
  console.log('═'.repeat(58) + '\n');
  if (failed > 0) process.exit(1);
}

run();
