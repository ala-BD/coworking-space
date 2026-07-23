/**
 * testModuleG.js — Tests API Module G (Formateurs & Formations)
 * ─────────────────────────────────────────────────────────────────
 * Usage :
 *   API_URL=http://localhost:5000 JWT_TOKEN=<token_admin> node backend/test/testModuleG.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TOKEN = process.env.JWT_TOKEN || 'VOTRE_TOKEN_JWT_ICI';

let passed = 0;
let failed = 0;
let createdFormateurId = null;
let createdFormationId = null;
let createdRemunerationId = null;

function log(message, ok = true) {
  console.log(`  ${ok ? '✅' : '❌'}  ${message}`);
  if (ok) passed += 1; else failed += 1;
}

function logSection(title) {
  console.log(`\n${'─'.repeat(62)}\n  📋  ${title}\n${'─'.repeat(62)}`);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` } };
  if (body) opts.body = JSON.stringify(body);

  const response = await fetch(`${API_URL}${path}`, opts);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, body: data };
}

async function testSecurity() {
  logSection('Sécurité — accès non authentifié');
  const res = await fetch(`${API_URL}/api/formations`);
  const body = await res.json().catch(() => ({}));
  log('Statut 401 sans jeton', res.status === 401);
  log('Réponse erreur présente', !!body.error);
}

async function testGetFormateurs() {
  logSection('GET /api/formateurs — Liste des formateurs');
  const { status, body } = await api('GET', '/api/formateurs');
  log('Statut HTTP 200', status === 200);
  log('Champ "formateurs" présent', Array.isArray(body.formateurs));

  if (Array.isArray(body.formateurs) && body.formateurs.length > 0) {
    const first = body.formateurs[0];
    log('Premier formateur contient id', typeof first.id === 'string');
    log('Premier formateur contient nom', typeof first.nom === 'string');
    log('Premier formateur contient prenom', typeof first.prenom === 'string');
    log('Premier formateur contient email', typeof first.email === 'string');
    console.log(`     · ${body.formateurs.length} formateur(s) trouvé(s)`);
    createdFormateurId = first.id;
  } else {
    log('Aucun formateur dans la base', true);
  }
}

async function testCreateFormateur() {
  logSection('POST /api/formateurs — Création d’un formateur');
  const email = `test.formateur.${Date.now()}@example.com`;
  const payload = {
    nom: 'Testeur',
    prenom: 'Test',
    email,
    telephone: '+33600000000',
    specialite: 'Formation test',
    biographie: 'Créé par testModuleG.js',
  };

  const { status, body } = await api('POST', '/api/formateurs', payload);
  log('Statut HTTP 201', status === 201);
  log('Champ "formateur" présent', !!body.formateur);

  if (body.formateur) {
    createdFormateurId = body.formateur.id;
    log('Formateur a un id', typeof body.formateur.id === 'string');
    log('Email correspond', body.formateur.email === email);
    log('Formateur a spécialité', body.formateur.specialite === payload.specialite);
    console.log(`     · Formateur créé : ${createdFormateurId}`);
  }
}

async function testGetFormateurById() {
  if (!createdFormateurId) {
    logSection('GET /api/formateurs/:id — Ignoré (aucun formateur testé)');
    log('Test ignoré', true);
    return;
  }

  logSection(`GET /api/formateurs/${createdFormateurId} — Détail formateur`);
  const { status, body } = await api('GET', `/api/formateurs/${createdFormateurId}`);
  log('Statut HTTP 200', status === 200);
  log('Champ "formateur" présent', !!body.formateur);
  log('Champ "formations" présent', Array.isArray(body.formations));
  log('Champ "remuneration" présent', Array.isArray(body.remuneration));
}

async function testPatchFormateur() {
  if (!createdFormateurId) {
    logSection('PATCH /api/formateurs/:id — Ignoré (aucun formateur testé)');
    log('Test ignoré', true);
    return;
  }

  logSection(`PATCH /api/formateurs/${createdFormateurId} — Modification formateur`);
  const { status, body } = await api('PATCH', `/api/formateurs/${createdFormateurId}`, {
    telephone: '+33611112222',
    specialite: 'Formation test modifiée',
  });

  log('Statut HTTP 200', status === 200);
  log('Téléphone mis à jour', body.formateur?.telephone === '+33611112222');
  log('Spécialité mis à jour', body.formateur?.specialite === 'Formation test modifiée');
}

async function testGetFormations() {
  logSection('GET /api/formations — Catalogue');
  const { status, body } = await api('GET', '/api/formations');
  log('Statut HTTP 200', status === 200);
  log('Champ "formations" présent', Array.isArray(body.formations));

  if (Array.isArray(body.formations) && body.formations.length > 0) {
    const first = body.formations[0];
    log('Formation a un titre', typeof first.titre === 'string');
    log('Formation a date_debut', typeof first.date_debut === 'string');
    log('Formation a capacite_max', typeof first.capacite_max === 'number');
    log('Formation a nb_inscrits', 'nb_inscrits' in first);
    log('Formation a places_restantes', 'places_restantes' in first);
    console.log(`     · ${body.formations.length} formation(s) trouvée(s)`);
  }
}

async function testCreateFormation() {
  if (!createdFormateurId) {
    logSection('POST /api/formations — Ignoré (aucun formateur disponible)');
    log('Test ignoré', true);
    return;
  }

  logSection('POST /api/formations — Création d’une formation');
  const debut = new Date(Date.now() + 7 * 86400000).toISOString();
  const fin = new Date(Date.now() + 7 * 86400000 + 3 * 3600000).toISOString();

  const { status, body } = await api('POST', '/api/formations', {
    titre: 'Test Formation Module G',
    description: 'Formation de test créée par testModuleG.js',
    formateur_id: createdFormateurId,
    date_debut: debut,
    date_fin: fin,
    capacite_max: 12,
    prix_inscription: 0,
    statut: 'planifiee',
  });

  log('Statut HTTP 201', status === 201);
  log('Champ "formation" présent', !!body.formation);

  if (body.formation) {
    createdFormationId = body.formation.id;
    log('Formation a un id', typeof body.formation.id === 'string');
    log('Titre correct', body.formation.titre === 'Test Formation Module G');
    log('Statut = planifiee', body.formation.statut === 'planifiee');
    log('Capacité 12', body.formation.capacite_max === 12);
    console.log(`     · Formation créée : ${createdFormationId}`);
  }
}

async function testGetFormationById() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`GET /api/formations/${createdFormationId} — Détail formation`);
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}`);
  log('Statut HTTP 200', status === 200);
  log('Champ "formation" présent', !!body.formation);
  log('Champ "participants" présent', Array.isArray(body.participants));
  log('nb_inscrits = 0', body.formation?.nb_inscrits === 0);
  log('places_restantes = capacite', body.formation?.places_restantes === body.formation?.capacite_max);
}

async function testPatchFormation() {
  if (!createdFormationId) {
    logSection('PATCH /api/formations/:id — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`PATCH /api/formations/${createdFormationId} — Modification formation`);
  const { status, body } = await api('PATCH', `/api/formations/${createdFormationId}`, {
    titre: 'Test Formation Module G — Mis à jour',
    capacite_max: 15,
  });

  log('Statut HTTP 200', status === 200);
  log('Titre modifié', body.formation?.titre === 'Test Formation Module G — Mis à jour');
  log('Capacité modifiée', body.formation?.capacite_max === 15);
}

async function testInscription() {
  if (!createdFormationId) {
    logSection('POST /api/formations/:id/inscriptions — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`POST /api/formations/${createdFormationId}/inscriptions — Inscription`);
  const { status, body } = await api('POST', `/api/formations/${createdFormationId}/inscriptions`);
  log('Statut 201 ou 409', status === 201 || status === 409);

  if (status === 201) {
    log('Inscription créée', !!body.inscription);
    log('Statut inscription valide', ['confirmee', 'en_attente'].includes(body.inscription?.statut));
  } else {
    log('Doublon ou inscription déjà existante', true);
  }
}

async function testParticipants() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id/inscriptions — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`GET /api/formations/${createdFormationId}/inscriptions — Participants`);
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}/inscriptions`);
  log('Statut HTTP 200', status === 200);
  log('Champ "participants" présent', Array.isArray(body.participants));
  log('Champ "liste_attente" présent', Array.isArray(body.liste_attente));
}

async function testEmargement() {
  if (!createdFormationId) {
    logSection('GET /api/formations/:id/emargement — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`GET /api/formations/${createdFormationId}/emargement — Émargement`);
  const { status, body } = await api('GET', `/api/formations/${createdFormationId}/emargement`);
  log('Statut HTTP 200', status === 200);
  log('Champ "formation" présent', !!body.formation);
  log('Champ "participants" présent', Array.isArray(body.participants));
}

async function testCreateRemuneration() {
  if (!createdFormateurId || !createdFormationId) {
    logSection('POST /api/formateurs/:id/remuneration — Ignoré (formateur ou formation manquant)');
    log('Test ignoré', true);
    return;
  }

  logSection(`POST /api/formateurs/${createdFormateurId}/remuneration — Enregistrement rémunération`);
  const { status, body } = await api('POST', `/api/formateurs/${createdFormateurId}/remuneration`, {
    formation_id: createdFormationId,
    montant: 300,
    statut: 'en_attente',
    note: 'Rémunération test',
  });

  log('Statut HTTP 201', status === 201);
  log('Donnée rémunération reçue', !!body.remuneration || !!body.data);
  if (body.remuneration) {
    createdRemunerationId = body.remuneration.id;
    console.log(`     · Rémunération créée : ${createdRemunerationId}`);
  }
}

async function testMemberFormations() {
  logSection('GET /api/members/me/formations — Mes formations');
  const { status, body } = await api('GET', '/api/members/me/formations');
  log('Statut 200 ou erreur autorisation', status === 200 || status === 403);
  if (status === 200) {
    log('Champ "inscriptions" présent', Array.isArray(body.inscriptions));
  }
}

async function testDeleteFormation() {
  if (!createdFormationId) {
    logSection('DELETE /api/formations/:id — Ignoré (aucune formation créée)');
    log('Test ignoré', true);
    return;
  }

  logSection(`DELETE /api/formations/${createdFormationId} — Suppression / annulation`);
  const { status, body } = await api('DELETE', `/api/formations/${createdFormationId}`);
  log('Statut HTTP 200', status === 200);
  log('Message de suppression présent', typeof body.message === 'string');
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   MODULE G — Test API Formateurs & Formations                      ║');
  console.log('║   Coworking Space                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  🌐  API : ${API_URL}`);

  if (TOKEN === 'VOTRE_TOKEN_JWT_ICI') {
    console.log('\n  ⚠️  Le JWT_TOKEN n’est pas défini. Définissez JWT_TOKEN=<token_admin> puis relancez.\n');
    process.exit(1);
  }

  try {
    await testSecurity();
    await testGetFormateurs();
    if (!createdFormateurId) await testCreateFormateur();
    await testGetFormateurById();
    await testPatchFormateur();
    await testGetFormations();
    await testCreateFormation();
    await testGetFormationById();
    await testPatchFormation();
    await testInscription();
    await testParticipants();
    await testEmargement();
    await testCreateRemuneration();
    await testMemberFormations();
    await testDeleteFormation();
  } catch (error) {
    console.error('\n  💥  Erreur inattendue :', error.message || error);
    failed += 1;
  }

  console.log('\n' + '═'.repeat(62));
  console.log(`  Résultats : ${passed} ✅  /  ${failed} ❌  /  ${passed + failed} total`);
  console.log('═'.repeat(62) + '\n');
  if (failed > 0) process.exit(1);
}

run();
