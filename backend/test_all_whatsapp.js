// backend/test_all_whatsapp.js
// Envoi séquentiel de tous les types de notifications WhatsApp vers le 98115865 pour validation

require('dotenv').config();
const { sendWhatsApp, generateWhatsAppMessage } = require('./services/whatsappService');

const TARGET_PHONE = '98115865';

const notificationsList = [
  {
    type: 'nouveau_membre',
    label: '1. Bienvenue Nouveau Membre',
    data: {
      membre: { prenom: 'Ala', nom: 'Ben Dawed' },
    },
  },
  {
    type: 'confirmation_reservation',
    label: '2. Confirmation de Réservation',
    data: {
      membre: { prenom: 'Ala' },
      reservation: {
        espaces: { nom: 'Bureau Privé Exécutif (Salle 302)' },
        date_debut: new Date(Date.now() + 86400000).toISOString(),
        date_fin: new Date(Date.now() + 86400000 + 4 * 3600000).toISOString(),
        montant: 45,
      },
    },
  },
  {
    type: 'rappel_reservation_j1',
    label: '3. Rappel Réservation J-1',
    data: {
      membre: { prenom: 'Ala' },
      reservation: {
        espaces: { nom: 'Espace Open Space & Lounge' },
        date_debut: new Date(Date.now() + 86400000).toISOString(),
      },
    },
  },
  {
    type: 'alerte_15min_avant_fin',
    label: '4. Alerte 15min avant la Fin',
    data: {
      membre: { prenom: 'Ala' },
      session: {
        espaces: { nom: 'Salle de Réunion Atlas (10 personnes)' },
      },
    },
  },
  {
    type: 'fin_session',
    label: '5. Fin de Session',
    data: {
      membre: { prenom: 'Ala' },
    },
  },
  {
    type: 'depassement_session',
    label: '6. Alerte Dépassement de Temps',
    data: {
      membre: { prenom: 'Ala' },
      minutesDepassement: 20,
    },
  },
  {
    type: 'inscription_formation',
    label: '7. Inscription Formation Confirmée',
    data: {
      membre: { prenom: 'Ala' },
      formation: {
        titre: 'Masterclass : Architecture Cloud & Node.js',
        date_debut: new Date(Date.now() + 3 * 86400000).toISOString(),
        formateur_nom: 'Dr. Karim Mansour',
      },
    },
  },
  {
    type: 'rappel_formation_j1',
    label: '8. Rappel Formation J-1',
    data: {
      membre: { prenom: 'Ala' },
      formation: {
        titre: 'Masterclass : Architecture Cloud & Node.js',
        date_debut: new Date(Date.now() + 86400000).toISOString(),
      },
    },
  },
  {
    type: 'paiement_enregistre',
    label: '9. Reçu de Paiement Enregistré',
    data: {
      membre: { prenom: 'Ala' },
      payment: {
        montant: 180,
        numero_recu: 'REC-2026-0914',
        moyen_paiement: 'Carte Bancaire (Stripe)',
      },
    },
  },
  {
    type: 'paiement_retard_j3',
    label: '10. Rappel Facture Impayée',
    data: {
      membre: { prenom: 'Ala' },
      payment: {
        montant: 95,
      },
    },
  },
  {
    type: 'abonnement_expirant_j7',
    label: '11. Renouvellement Forfait J-7',
    data: {
      membre: { prenom: 'Ala' },
      abonnement: {
        type_forfait: 'Pass Illimité Dédié Pro (Mensuel)',
        date_fin: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    },
  },
  {
    type: 'abonnement_expire',
    label: '12. Forfait Expiré',
    data: {
      membre: { prenom: 'Ala' },
    },
  },
  {
    type: 'annulation_reservation',
    label: '13. Annulation de Réservation',
    data: {
      membre: { prenom: 'Ala' },
      reservation: {
        espaces: { nom: 'Box Phone & Visio #2' },
      },
      remboursement: true,
    },
  },
  {
    type: 'nouveau_message_portail',
    label: '14. Nouveau Message Reçu',
    data: {
      membre: { prenom: 'Ala' },
      expediteur: { prenom: 'Administration DeskyWork' },
      message: {
        sujet: 'Votre facture d\'abonnement et badge d\'accès sont prêts',
      },
    },
  },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log(`🚀 Démarrage de l'envoi des ${notificationsList.length} notifications WhatsApp vers le ${TARGET_PHONE}...\n`);

  let count = 0;
  for (const item of notificationsList) {
    count++;
    console.log(`[${count}/${notificationsList.length}] Envoi : ${item.label}...`);
    const message = generateWhatsAppMessage(item.type, item.data, {});
    const res = await sendWhatsApp(TARGET_PHONE, message);
    if (res.success) {
      console.log(`  ✅ Délivré (ID: ${res.messageId})`);
    } else {
      console.error(`  ❌ Échec : ${res.error}`);
    }
    // Pause de 1.5s entre chaque message pour éviter tout flood
    await sleep(1500);
  }

  console.log(`\n🎉 Terminé ! Toutes les ${notificationsList.length} notifications ont été expédiées à WhatsApp.`);
}

run();
