// backend/test/testEmailTemplates.js
// Script de test pour vérifier les 15 templates email du Module F
// Usage : node backend/test/testEmailTemplates.js

const fs = require('fs');
const path = require('path');
const templates = require('../templates/emailTemplates');

// ── Configuration de test ──────────────────────────────────────────────────
const config = {
  coworkingName: 'Thirty Three Space',
  coworkingEmail: 'contact@33space.tn',
  coworkingTel: '+216 XX XXX XXX',
  coworkingAdresse: 'Tunis, Tunisie',
};

// ── Données de test ────────────────────────────────────────────────────────
const testData = {
  membre: {
    id: 'test-membre-1',
    prenom: 'Ahmed',
    nom: 'Ben Salah',
    email: 'ahmed.bensalah@example.tn',
    telephone: '+216 20 123 456',
  },
  
  reservation: {
    id: 'test-reservation-1',
    date_debut: new Date('2026-07-25T09:00:00'),
    date_fin: new Date('2026-07-25T17:00:00'),
    espaces: {
      nom: 'Open Space - Niveau 1',
      type: 'open_space',
    },
  },
  
  session: {
    id: 'test-session-1',
    reservations: {
      date_debut: new Date('2026-07-24T14:00:00'),
      date_fin: new Date('2026-07-24T18:00:00'),
      espaces: {
        nom: 'Salle de Réunion A',
        type: 'meeting_room',
      },
    },
  },
  
  abonnement: {
    id: 'test-abonnement-1',
    type: 'mensuel',
    date_debut: new Date('2026-07-01'),
    date_fin: new Date('2026-07-31'),
  },
  
  payment: {
    id: 'test-payment-1',
    numero_recu: 'REC-2026-001234',
    montant: 150.000,
    statut: 'paid',
    mode: 'cash',
    date_paiement: new Date('2026-07-24'),
    created_at: new Date('2026-07-24'),
    profiles: {
      prenom: 'Ahmed',
      nom: 'Ben Salah',
      email: 'ahmed.bensalah@example.tn',
    },
    reservations: {
      date_debut: new Date('2026-07-25T09:00:00'),
      date_fin: new Date('2026-07-25T17:00:00'),
      espaces: {
        nom: 'Open Space',
      },
    },
  },
  
  formation: {
    id: 'test-formation-1',
    titre: 'Atelier : Gestion de Projet Agile',
    date: new Date('2026-07-26T10:00:00'),
    formateurs: {
      nom: 'Fatma Gharbi',
    },
    espaces: {
      nom: 'Salle de Formation B',
    },
  },
  
  message: {
    sujet: 'Demande d\'information sur les tarifs',
    contenu: 'Bonjour,\n\nJ\'aimerais avoir plus d\'informations sur vos tarifs mensuels pour un bureau privé.\n\nMerci d\'avance !',
  },
  
  expediteur: {
    prenom: 'Ahmed',
    nom: 'Ben Salah',
  },
};

// ── Dossier de sortie ──────────────────────────────────────────────────────
const outputDir = path.join(__dirname, '../test/output-emails');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🧪 TEST DES TEMPLATES EMAIL — MODULE F\n');
console.log('📂 Les fichiers HTML seront générés dans : backend/test/output-emails/\n');
console.log('═'.repeat(70));

// ══════════════════════════════════════════════════════════════════════════
// TESTS DES 15 TEMPLATES
// ══════════════════════════════════════════════════════════════════════════

const tests = [
  {
    num: 1,
    name: 'Nouveau Membre',
    template: templates.templateNouveauMembre,
    args: [testData.membre, config],
    filename: '01-nouveau-membre.html',
  },
  {
    num: 2,
    name: 'Confirmation Réservation',
    template: templates.templateConfirmationReservation,
    args: [testData.reservation, testData.membre, config],
    filename: '02-confirmation-reservation.html',
  },
  {
    num: 3,
    name: 'Rappel Réservation J-1',
    template: templates.templateRappelReservationJ1,
    args: [testData.reservation, testData.membre, config],
    filename: '03-rappel-reservation-j1.html',
  },
  {
    num: 4,
    name: 'Alerte 15min Avant Fin',
    template: templates.templateAlerte15MinAvantFin,
    args: [testData.session, testData.membre, config],
    filename: '04-alerte-15min-avant-fin.html',
  },
  {
    num: 5,
    name: 'Fin de Session',
    template: templates.templateFinSession,
    args: [testData.session, testData.membre, config],
    filename: '05-fin-session.html',
  },
  {
    num: 6,
    name: 'Dépassement Session',
    template: templates.templateDepassementSession,
    args: [testData.session, testData.membre, 12, config],
    filename: '06-depassement-session.html',
  },
  {
    num: 7,
    name: 'Abonnement Expirant J-7',
    template: templates.templateAbonnementExpirantJ7,
    args: [testData.abonnement, testData.membre, config],
    filename: '07-abonnement-expirant-j7.html',
  },
  {
    num: 8,
    name: 'Abonnement Expiré',
    template: templates.templateAbonnementExpire,
    args: [testData.abonnement, testData.membre, config],
    filename: '08-abonnement-expire.html',
  },
  {
    num: 9,
    name: 'Paiement Enregistré',
    template: templates.templatePaiementEnregistre,
    args: [testData.payment, testData.membre, config],
    filename: '09-paiement-enregistre.html',
  },
  {
    num: 10,
    name: 'Paiement Retard J+3',
    template: templates.templatePaiementRetardJ3,
    args: [testData.payment, testData.membre, config],
    filename: '10-paiement-retard-j3.html',
  },
  {
    num: 11,
    name: 'Paiement Retard J+7',
    template: templates.templatePaiementRetardJ7,
    args: [testData.payment, testData.membre, config],
    filename: '11-paiement-retard-j7.html',
  },
  {
    num: 12,
    name: 'Annulation Réservation',
    template: templates.templateAnnulationReservation,
    args: [testData.reservation, testData.membre, config],
    filename: '12-annulation-reservation.html',
  },
  {
    num: 13,
    name: 'Inscription Formation',
    template: templates.templateInscriptionFormation,
    args: [testData.formation, testData.membre, config],
    filename: '13-inscription-formation.html',
  },
  {
    num: 14,
    name: 'Rappel Formation J-1',
    template: templates.templateRappelFormationJ1,
    args: [testData.formation, testData.membre, config],
    filename: '14-rappel-formation-j1.html',
  },
  {
    num: 15,
    name: 'Nouveau Message Portail',
    template: templates.templateNouveauMessagePortail,
    args: [testData.message, testData.expediteur, config],
    filename: '15-nouveau-message-portail.html',
  },
];

// ── Exécution des tests ────────────────────────────────────────────────────
let successes = 0;
let failures = 0;

tests.forEach(test => {
  try {
    console.log(`\n${test.num}. Test : ${test.name}`);
    
    // Générer le HTML
    const html = test.template(...test.args);
    
    // Vérifications basiques
    if (!html || html.length < 100) {
      throw new Error('HTML généré trop court ou vide');
    }
    if (!html.includes('<!DOCTYPE html>')) {
      throw new Error('DOCTYPE manquant');
    }
    if (!html.includes(config.coworkingName)) {
      throw new Error('Nom du coworking manquant');
    }
    
    // Sauvegarder le fichier
    const filepath = path.join(outputDir, test.filename);
    fs.writeFileSync(filepath, html, 'utf8');
    
    console.log(`   ✅ HTML généré (${(html.length / 1024).toFixed(1)} KB)`);
    console.log(`   📄 Fichier : ${test.filename}`);
    successes++;
    
  } catch (err) {
    console.log(`   ❌ ERREUR : ${err.message}`);
    failures++;
  }
});

// ── Résumé final ───────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('\n📊 RÉSUMÉ DES TESTS\n');
console.log(`✅ Réussis  : ${successes} / ${tests.length}`);
console.log(`❌ Échoués  : ${failures} / ${tests.length}`);
console.log(`\n📂 Ouvrez les fichiers HTML dans : ${outputDir}`);
console.log('\n💡 Pour visualiser les emails, ouvrez les fichiers .html dans un navigateur.\n');

if (failures === 0) {
  console.log('🎉 TOUS LES TESTS SONT RÉUSSIS !\n');
  process.exit(0);
} else {
  console.log('⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.\n');
  process.exit(1);
}
