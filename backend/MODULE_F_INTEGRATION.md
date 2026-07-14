# MODULE F — Notifications Automatiques
## Intégration Backend Complète (S3 - DEV2)

**Date**: 20-24 Juillet 2026  
**Responsable**: DEV2  
**Statut**: ✅ **COMPLÉTÉ**

---

## 📋 Vue d'ensemble

Le Module F implémente un système complet de notifications automatiques par email pour tous les événements critiques du système de gestion coworking.

### Périmètre
- ✅ **15 types de notifications** (CDC Tableau F, page 13)
- ✅ **Email prioritaire** (SMTP Nodemailer)
- ⏳ **SMS optionnel** (Telnet SMS API — en attente validation client)
- ✅ **Enregistrement audit** (table `notifications`)
- ✅ **Templates HTML responsive** (design "Encre & Cobalt")

---

## 🗂️ Structure des fichiers

```
backend/
├── services/
│   └── notificationService.js        ✅ Service centralisé (15 fonctions)
├── templates/
│   └── emailTemplates.js             ✅ 15 templates HTML
├── cron/
│   ├── paymentReminders.js           ✅ Relances impayés (Module C)
│   ├── reservationReminders.js       ✅ NEW - Rappels réservations
│   └── subscriptionReminders.js      ✅ NEW - Rappels abonnements
├── test/
│   ├── testEmailTemplates.js         ✅ Test des 15 templates
│   ├── testNotificationService.js    ✅ Test du service
│   ├── testCronFunctions.js          ✅ Test des fonctions cron
│   ├── testReservationCron.js        ✅ Test cron réservations
│   └── testSubscriptionCron.js       ✅ Test cron abonnements
└── server.js                         ✅ Intégration routes (F4)
```

---

## 📨 Liste des 15 notifications

| # | Type | Événement déclencheur | Canal | Status |
|---|------|----------------------|-------|--------|
| 1 | `nouveau_membre` | Inscription validée | Email | ✅ |
| 2 | `confirmation_reservation` | POST `/api/bookings` | Email | ✅ |
| 3 | `rappel_reservation_j1` | Cron quotidien 18h | Email | ✅ |
| 4 | `alerte_15min_avant_fin` | Cron toutes les 5 min | Email | ✅ |
| 5 | `fin_session` | Cron toutes les 2 min | Email | ✅ |
| 6 | `depassement_session` | Cron toutes les 5 min | Email | ✅ |
| 7 | `abonnement_expirant_j7` | Cron quotidien 10h | Email | ✅ |
| 8 | `abonnement_expire` | Cron quotidien 08h | Email | ✅ |
| 9 | `paiement_enregistre` | PATCH `/api/payments/:id` (paid) | Email | ✅ |
| 10 | `paiement_retard_j3` | Cron quotidien 09h | Email | ✅ |
| 11 | `paiement_retard_j7` | Cron quotidien 09h | Email | ✅ |
| 12 | `annulation_reservation` | DELETE `/api/bookings/:id` | Email | ✅ |
| 13 | `inscription_formation` | POST `/api/formations/:id/inscriptions` | Email | ⏳ Module G |
| 14 | `rappel_formation_j1` | Cron quotidien 18h | Email | ⏳ Module G |
| 15 | `nouveau_message_portail` | POST `/api/messages` | Email | ⏳ Module E |

**Légende**: ✅ Implémenté | ⏳ En attente autre module

---

## ⏰ Planning des tâches CRON

### Réservations (`reservationReminders.js`)

| Tâche | Fréquence | Heure | Description |
|-------|-----------|-------|-------------|
| Rappel J-1 | Quotidien | 18h00 | Envoie un email 1 jour avant la réservation |
| Alerte 15 min | 5 minutes | - | Alerte 15 min avant la fin de session |
| Fin session | 2 minutes | - | Notifie la fin + change `statut` → `completed` |
| Dépassement | 5 minutes | - | Alerte si session dépasse l'heure prévue |

### Abonnements (`subscriptionReminders.js`)

| Tâche | Fréquence | Heure | Description |
|-------|-----------|-------|-------------|
| Rappel J-7 | Quotidien | 10h00 | Abonnement expire dans 7 jours |
| Rappel J-3 | Quotidien | 10h30 | Abonnement expire dans 3 jours |
| Expiration | Quotidien | 08h00 | Détecte expiration + suspend compte |
| Renouvellement auto | Quotidien | 06h00 | Renouvelle abonnements avec `renouvellement_auto = true` |

### Paiements (`paymentReminders.js` — Module C)

| Tâche | Fréquence | Heure | Description |
|-------|-----------|-------|-------------|
| Relances impayés | Quotidien | 09h00 | Relance J+3, J+7, J+15 + suspension J+15 |

---

## 🔗 Intégration dans les routes (F4)

### 1. POST `/api/bookings` — Confirmation réservation
**Fichier**: `server.js` (ligne ~476)

```javascript
// Après création de la réservation
await notifyConfirmationReservation(
  supabaseAdmin,
  { id: data.id, date_debut, date_fin, espaces: data.espaces },
  { id: req.user.id, nom, prenom, email: req.user.email }
);
```

**Flux**:
1. Membre crée une réservation
2. API enregistre dans `reservations` (statut = `pending`)
3. Notification envoyée immédiatement
4. Email de confirmation reçu

---

### 2. DELETE `/api/bookings/:id` — Annulation réservation
**Fichier**: `server.js` (ligne ~494) — **NOUVELLE ROUTE**

```javascript
// Après annulation
await notifyAnnulationReservation(
  supabaseAdmin,
  { id, date_debut, date_fin, espaces },
  { id: user_id, nom, prenom, email }
);
```

**Flux**:
1. Membre/admin annule une réservation
2. API met à jour `statut` → `cancelled`
3. Notification d'annulation envoyée
4. Email de confirmation d'annulation reçu

---

### 3. PATCH `/api/payments/:id` — Paiement enregistré
**Fichier**: `server.js` (ligne ~750)

```javascript
// Quand statut passe à "paid"
if (statut === 'paid') {
  await notifyPaiementEnregistre(supabaseAdmin, payment, membre);
  // + ancien système PDF (Module C)
}
```

**Flux**:
1. Admin marque un paiement comme `paid`
2. API met à jour `paiements.statut` → `paid`
3. Notification Module F envoyée (HTML)
4. Email Module C envoyé (avec PDF du reçu en pièce jointe)

**Note**: Double notification intentionnelle pour garder compatibilité Module C.

---

### 4. POST `/api/members/welcome` — Email de bienvenue
**Fichier**: `server.js` (ligne ~195) — **NOUVELLE ROUTE**

```javascript
await notifyNouveauMembre(supabaseAdmin, {
  id: membre.id,
  nom, prenom, email
});
```

**Flux**:
1. Frontend appelle cette route après inscription Supabase Auth
2. API envoie l'email de bienvenue
3. Membre reçoit email avec guide de démarrage

**Usage côté frontend**:
```javascript
// Après signup réussi dans le frontend
await axios.post('/api/members/welcome', {}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## 🔧 Configuration requise

### Variables d'environnement (`.env`)

```env
# SMTP Configuration (requis pour Module F)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=mot-de-passe-app

# Coworking Info
COWORKING_NAME=Thirty Three Space
COWORKING_EMAIL=contact@33space.tn
COWORKING_TEL=+216 XX XXX XXX
COWORKING_ADRESSE=Tunis, Tunisie

# Frontend URL (pour liens dans emails)
FRONTEND_URL=http://localhost:5173
```

---

## 🧪 Tests réalisés

### Test 1 : Templates HTML (15/15 ✅)
```bash
node backend/test/testEmailTemplates.js
```

**Résultat**: 15 fichiers HTML générés dans `backend/test/output-emails/`

---

### Test 2 : Service de notifications (6/6 ✅)
```bash
node backend/test/testCronFunctions.js
```

**Résultat**:
- ✅ Rappel réservation J-1 → Email envoyé
- ✅ Alerte 15 min avant fin → Email envoyé
- ✅ Fin de session → Email envoyé
- ✅ Dépassement horaire → Email envoyé
- ✅ Rappel abonnement J-7 → Email envoyé
- ✅ Abonnement expiré → Email envoyé

---

## 📊 Base de données

### Table `notifications`
**Fichier**: `database/schema.sql` (ligne 70)

```sql
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('Email', 'SMS', 'Dashboard')),
    message TEXT NOT NULL,
    lu BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Politiques RLS
**Fichier**: `database/s2_dev2_rls_paiements.sql` (ligne 92)

- ✅ Membre voit ses propres notifications
- ✅ Admin/Staff voient toutes les notifications
- ✅ Admin/Staff peuvent créer des notifications
- ✅ Backend (service_role) bypass RLS automatiquement

---

## 🚀 Démarrage

### 1. Installation des dépendances
```bash
cd backend
npm install
```

### 2. Configuration SMTP
Éditer `backend/.env` avec vos identifiants SMTP.

### 3. Démarrer le serveur
```bash
node server.js
```

**Console attendue**:
```
⏰ CRON Job "Relances Impayés" planifié (Tous les jours à 09h00).
⏰ CRON Job "Rappels Réservations" planifié :
   - Rappel J-1 : Tous les jours à 18h00
   - Alerte 15 min : Toutes les 5 minutes
   - Fin de session : Toutes les 2 minutes
   - Dépassement : Toutes les 5 minutes
⏰ CRON Job "Rappels Abonnements" planifié :
   - Rappel J-7 : Tous les jours à 10h00
   - Rappel J-3 : Tous les jours à 10h30
   - Expiration : Tous les jours à 08h00
   - Renouvellement auto : Tous les jours à 06h00
API Dev 1 + Dev 2 démarrée sur http://localhost:5000
✅ Module F - Notifications automatiques activées.
```

---

## 📝 Notes importantes

### Double notification paiements
Les paiements envoient **2 emails** :
1. **Email HTML** (Module F) — Notification simple
2. **Email PDF** (Module C) — Reçu officiel en pièce jointe

C'est intentionnel pour garantir compatibilité avec Module C déjà en production.

### SMS non implémenté
L'architecture supporte les SMS (`canal: 'SMS'`) mais l'intégration Telnet SMS API est en attente de validation client. Les fonctions sont prêtes à recevoir un paramètre `canal` dans `sendNotification()`.

### Gestion des erreurs
Les notifications échouées **ne bloquent JAMAIS** les opérations principales (réservation, paiement, etc.). Les erreurs sont loggées mais silencieuses pour l'utilisateur final.

---

## ✅ Livrables S3 (20-24 Juillet)

| Étape | Description | Statut |
|-------|-------------|--------|
| **F1** | Templates HTML (15 emails) | ✅ Complété |
| **F2** | Service de notifications | ✅ Complété |
| **F3** | Cron jobs automatiques | ✅ Complété |
| **F4** | Intégration routes API | ✅ Complété |

---

## 🎯 Prochaines étapes (S4+)

### Module G — Formateurs & Formations (S5-S6)
- Implémenter `notifyInscriptionFormation()`
- Implémenter `notifyRappelFormationJ1()`
- Ajouter cron rappel formations J-1 (18h)

### Module E — Messagerie (S4-S5)
- Implémenter `notifyNouveauMessagePortail()`
- Intégrer dans POST `/api/messages`

### SMS (date à confirmer)
- Intégrer Telnet SMS API
- Ajouter paramètre `canal` dans fonctions
- Implémenter double notification (Email + SMS)

---

**Document rédigé par DEV2 — S3 (24 Juillet 2026)**  
**Validé**: En attente validation chef de projet
