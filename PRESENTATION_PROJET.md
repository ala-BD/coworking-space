# DeskyWork — Plateforme SaaS de Gestion d'Espaces de Coworking

**Document de présentation client — Description complète du projet**

---

## 1. Vue d'ensemble

DeskyWork est une plateforme SaaS (Software as a Service) complète dédiée à la gestion d'espaces de coworking. Elle permet à des opérateurs de coworking de gérer l'intégralité de leur activité depuis un seul outil : réservations, membres, paiements, formations, messagerie, notifications et bien plus.

La plateforme est **multi-tenant** : chaque espace de coworking dispose de son propre environnement isolé (données, membres, tarifs, espaces), tout en étant supervisé par un Super Administrateur central.

---

## 2. Architecture technique

### Frontend
| Technologie | Rôle |
|---|---|
| **React 19** | Framework UI — interfaces dynamiques et réactives |
| **Vite 8** | Bundler ultra-rapide, build optimisé pour la production |
| **React Router v7** | Navigation SPA, protection des routes par rôle |
| **Tailwind CSS v4** | Design system utility-first, responsive design |
| **Recharts** | Graphiques et visualisations des KPIs |
| **Socket.io Client** | Messagerie temps réel et notifications live |
| **Supabase JS Client** | Authentification OAuth, sessions, accès DB |
| **QRCode.react** | Génération de QR codes d'accès membres |
| **html5-qrcode** | Scan de QR codes depuis la caméra |
| **ExcelJS** | Export de données en fichiers Excel |
| **Lucide React** | Bibliothèque d'icônes SVG |

### Backend
| Technologie | Rôle |
|---|---|
| **Node.js + Express** | Serveur API REST, architecture MVC |
| **Supabase (PostgreSQL)** | Base de données relationnelle, Auth, Storage, Realtime |
| **Socket.io** | WebSockets — messagerie et notifications en temps réel |
| **Stripe** | Paiements en ligne sécurisés par carte bancaire |
| **Nodemailer** | Envoi d'emails transactionnels (SMTP) |
| **PDFKit** | Génération de reçus de paiement en PDF |
| **node-cron** | Tâches automatiques planifiées (rappels, relances) |
| **Axios** | Appels HTTP internes |

### Infrastructure & Déploiement
| Service | Usage |
|---|---|
| **Supabase** | BaaS — Auth, DB PostgreSQL, Storage, Realtime |
| **Vercel** | Hébergement frontend — déploiement continu depuis GitHub |
| **Render** | Hébergement backend — déploiement continu depuis GitHub |
| **GitHub** | Contrôle de version, CI/CD automatique |

---

## 3. Architecture multi-tenant

Chaque espace de coworking (appelé **tenant**) dispose de son propre environnement :
- Ses propres espaces, tarifs, membres, réservations et paiements
- Son propre administrateur et son équipe staff
- Son branding (logo, nom, description)
- Ses paramètres de politique d'annulation

Cette isolation est assurée par un `tenant_id` présent sur toutes les tables et appliqué automatiquement par le middleware backend. Un administrateur coworking ne peut jamais accéder aux données d'un autre coworking.

---

## 4. Rôles et niveaux d'accès

La plateforme définit **5 rôles distincts** :

| Rôle | Description | Accès |
|---|---|---|
| **Super Admin** | Opérateur de la plateforme DeskyWork | Vue globale de tous les coworkings, facturation B2B, supervision |
| **Admin Coworking** | Gestionnaire d'un espace de coworking | Gestion complète de son espace, membres, paiements, formations |
| **Staff** | Réceptionniste / opérationnel | Agenda, check-in, paiements du jour, messagerie |
| **Membre** | Utilisateur final | Réservations, abonnements, formations, paiements, messagerie |
| **Formateur** | Intervenant pédagogique | Création et gestion de formations, réservations de salles |

---

## 5. Authentification et sécurité

### Méthodes de connexion
- **Email + mot de passe** — avec vérification OTP par email lors de l'inscription
- **Google OAuth** — connexion en un clic pour les membres
- **LinkedIn OAuth** — connexion professionnelle pour les membres

### Flux d'inscription email
1. L'utilisateur remplit le formulaire (nom, prénom, email, téléphone, rôle, mot de passe)
2. Un code OTP à 6 chiffres est envoyé par email (valable 10 minutes)
3. L'utilisateur saisit le code — le compte est créé automatiquement à la validation
4. Pour les admins coworking : compte en **attente d'approbation** par le Super Admin
5. Pour les membres et formateurs : compte **activé immédiatement**

### Sécurité backend
- Chaque requête API est authentifiée via un **token JWT Supabase** (Bearer token)
- Le profil complet est chargé depuis la DB à chaque requête
- Les comptes suspendus ou en attente sont bloqués au niveau middleware
- La **Row Level Security (RLS)** de Supabase protège les données au niveau base de données
- L'isolation multi-tenant est appliquée automatiquement sur toutes les requêtes

---

## 6. Fonctionnalités détaillées

### 6.1 Gestion des espaces

L'administrateur peut créer et gérer **5 types d'espaces** :
- Open Space (partagé, gestion des places disponibles)
- Bureau Privé
- Salle de Réunion
- Salle de Formation
- Espace Événementiel

Pour chaque espace : nom, capacité, tarif horaire, photos (galerie multiple). Un système de **limite d'espaces par plan** contrôle la croissance selon l'abonnement SaaS souscrit.

La disponibilité est vérifiée en temps réel lors de toute tentative de réservation, en tenant compte du type d'espace (partagé vs exclusif) et des chevauchements existants.

---

### 6.2 Réservations — Processus en 3 étapes

**Étape 1** — Choix de l'espace et de la date
- Calendrier de disponibilité en temps réel
- Vérification automatique des conflits
- Calcul du montant basé sur le tarif horaire

**Étape 2** — Choix du mode de paiement
- Paiement en ligne (Stripe — carte bancaire)
- Paiement sur place (espèces à l'accueil)
- Vérification de la cohérence avec l'abonnement actif du membre

**Étape 3** — Confirmation et QR Code
- Réservation créée avec statut `en attente`
- L'admin confirme ou refuse la réservation depuis son tableau de bord
- À la confirmation : email automatique + notification temps réel + QR code d'accès généré

**Politique d'annulation configurable par l'admin** :
- Délai minimum avant annulation (en heures)
- Pourcentage de pénalité applicable
- Remboursement automatique ou crédit portefeuille
- Politique différenciée par type d'espace

---

### 6.3 Abonnements et tarification

Les membres peuvent souscrire à plusieurs formules :
- **Day Pass** — accès 1 jour
- **Week Pass** — accès 7 jours
- **Mensuel** — abonnement mensuel
- **Trimestriel** — abonnement 3 mois
- **Annuel** — abonnement 12 mois
- **Bureau Privé** — accès dédié, durée définie par l'admin

La tarification est **différenciée par type de membre** (individuel, entreprise, étudiant) et peut être restreinte à un type d'espace spécifique.

**Codes promo** : l'admin peut créer des codes de réduction (pourcentage ou montant fixe), avec date d'expiration et limite d'utilisations.

**Renouvellement automatique** : les abonnements avec l'option activée se renouvellent automatiquement chaque jour à 6h00.

---

### 6.4 Paiements

**Modes de paiement supportés** :
- Espèces (cash)
- Virement bancaire
- Chèque
- Paiement en ligne via Stripe

**Workflow de paiement en ligne (Stripe)** :
1. Le membre clique "Payer en ligne"
2. Une session Checkout Stripe est créée
3. Le membre est redirigé vers la page de paiement sécurisée Stripe
4. Après validation, retour sur la plateforme avec vérification automatique
5. Statut mis à jour en `paid`, reçu PDF généré et envoyé par email

**Reçus PDF** : chaque paiement confirmé génère un reçu professionnel téléchargeable (PDFKit) avec numéro de référence unique, détails de la réservation ou de l'abonnement, informations du coworking et QR code de vérification.

**Suivi des impayés** :
- Tableau de bord des paiements en attente
- Relances automatiques à J+3, J+7 et J+15
- Suspension automatique du compte à J+15 en cas de non-paiement

---

### 6.5 Formations et workshops

**Pour les formateurs** :
- Créer des formations avec titre, description, programme, prérequis, matériel nécessaire
- Réserver une salle de formation directement lors de la création
- Gérer les inscriptions et suivre le taux de remplissage
- Consulter les rémunérations (gérées par l'admin)

**Pour les membres** :
- Catalogue des formations disponibles avec filtres
- Inscription en ligne avec paiement intégré
- Rappel automatique J-1 par email et/ou WhatsApp
- Accès aux documents et supports de cours

**Pour les admins** :
- Gestion des candidatures formateurs
- Validation ou rejet des formations proposées
- Suivi des rémunérations à verser
- Diffusion automatique d'une notification à tous les membres lors de la publication d'une nouvelle formation

---

### 6.6 Messagerie temps réel

Système de messagerie interne bidirectionnel entre membres et équipe du coworking :
- Conversations de type "support" initiées par le membre ou par l'admin
- Messages en temps réel via **WebSockets (Socket.io)**
- Indicateur de messages non lus
- Notification par email lors d'un nouveau message
- Historique complet des échanges
- Assignation automatique de l'équipe staff au fil de la conversation

---

### 6.7 Notifications automatiques

La plateforme envoie des notifications sur **deux canaux configurables par l'utilisateur** :
- **Email** (SMTP, templates HTML professionnels avec logo du coworking)
- **WhatsApp** (compatible UltraMsg, Twilio, Meta Cloud API, Green API)

**Liste complète des notifications automatiques** :

| Événement | Canal |
|---|---|
| Bienvenue nouveau membre | Email + WhatsApp |
| Bienvenue nouveau formateur | Email + WhatsApp |
| Confirmation de réservation | Email + WhatsApp |
| Rappel réservation J-1 | Email + WhatsApp |
| Alerte 15 min avant fin de session | Email + WhatsApp |
| Fin de session | Email + WhatsApp |
| Dépassement horaire détecté | Email + WhatsApp |
| Abonnement expirant dans 7 jours | Email + WhatsApp |
| Abonnement expirant dans 3 jours | Email + WhatsApp |
| Abonnement expiré | Email + WhatsApp |
| Paiement enregistré (reçu) | Email + WhatsApp |
| Paiement en retard J+3 | Email + WhatsApp |
| Paiement en retard J+7 | Email + WhatsApp |
| Annulation de réservation | Email + WhatsApp |
| Inscription à une formation | Email + WhatsApp |
| Rappel formation J-1 | Email + WhatsApp |
| Nouvelle formation disponible | Email (broadcast tous membres) |
| Nouveau message reçu | Email + WhatsApp |

Toutes les notifications sont également enregistrées dans la base de données et affichées dans le tableau de bord de l'utilisateur (centre de notifications avec statut lu/non lu en temps réel).

---

### 6.8 Sessions et check-in

- Check-in QR code : le membre présente son QR code à l'accueil, le staff le scanne pour démarrer la session
- Timer temps réel affiché dans le tableau de bord de l'admin
- Alertes automatiques à 15 minutes de la fin
- Détection automatique des dépassements horaires
- Clôture automatique des sessions expirées (cron toutes les 2 minutes)

---

### 6.9 Tableau de bord Admin — KPIs

Le tableau de bord admin offre une vue complète de l'activité avec **sélection de période** (jour / mois / année / tout) :

**Indicateurs clés** :
- Chiffre d'affaires (jour, mois, année, période sélectionnée)
- Évolution vs période précédente (%)
- Nombre de membres actifs et nouveaux membres
- Taux d'occupation moyen par espace
- Sessions en cours en temps réel
- Paiements en attente et montant total
- Abonnements expirant dans 7 jours
- Réservations du jour

**Graphiques** :
- Courbe d'évolution du CA (par heure / jour / mois / année selon la période)
- Taux d'occupation par espace
- CA par espace
- Réservations confirmées vs en attente

**Rapport intelligent automatique** :
Un moteur d'analyse embarqué génère automatiquement :
- Un verdict global (positif / attention / danger)
- 6 sections d'analyse détaillées (revenus, occupation, membres, réservations, paiements, formations)
- Détection automatique des anomalies (baisse de CA, impayés, espaces vides, formations sous-remplies)
- Recommandations actionnables classées par priorité

---

### 6.10 Profil coworking et multi-sites

L'admin peut configurer le profil public de son coworking :
- Nom, description, adresse, ville, pays
- Logo et photo de couverture
- Coordonnées GPS (latitude/longitude)
- Contact (email, téléphone, site web)

Support **multi-sites** : un même admin peut gérer plusieurs établissements depuis une interface unifiée.

**Page publique de découverte** (CoworkingDetail) : fiche publique du coworking accessible sans connexion, visible sur la landing page.

---

### 6.11 Portail membre

Chaque membre dispose d'un espace personnel complet :
- **Tableau de bord** : résumé de l'activité, prochaines réservations, statut abonnement
- **Mes réservations** : historique et suivi des réservations en cours
- **Mon QR Code** : QR code d'accès personnalisé, téléchargeable
- **Abonnement** : consultation du forfait actif, renouvellement en ligne
- **Mes factures** : historique des paiements, téléchargement PDF des reçus
- **Formations** : catalogue et inscriptions
- **Messagerie** : chat support avec l'équipe du coworking
- **Notifications** : centre de notifications avec filtre par type
- **Mon profil** : modification des informations personnelles et des préférences de notification
- **Documents** : gestion des documents personnels (justificatifs, contrats)
- **RGPD** : gestion des données personnelles et droit à l'oubli

---

### 6.12 Espace formateur

Interface dédiée aux formateurs :
- **Tableau de bord** : résumé des formations et prochaines sessions
- **Mes formations** : création, modification, gestion des inscriptions
- **Mon planning** : vue calendrier des formations à venir
- **Mes réservations** : réservations d'espaces liées aux formations
- **Mes factures** : suivi des rémunérations
- **Messagerie** : communication avec l'admin
- **Mon profil** : spécialité, biographie, informations professionnelles
- **Mes coworkings** : liste des espaces partenaires avec lesquels le formateur collabore

---

### 6.13 Super Admin — Supervision globale

Le Super Admin supervise l'ensemble de la plateforme :

**Gestion des coworkings (tenants)** :
- Liste complète avec statut, plan, nombre de membres et d'espaces
- Création de nouveaux coworkings avec envoi d'invitation à l'admin
- Modification du plan, des limites et du statut (actif / suspendu)
- Onboarding guidé pour les nouveaux opérateurs

**Supervision cross-tenant** :
- Réservations globales (tous coworkings confondus)
- Paiements globaux avec filtres avancés
- Formations globales avec suivi des inscriptions
- Espaces globaux avec possibilité de modification

**Gestion des utilisateurs** :
- Vue de tous les utilisateurs avec filtres par rôle, tenant, statut
- Modification du rôle et du statut d'un compte
- Suppression de compte avec nettoyage complet des données
- Résumé de la répartition des rôles

**Facturation B2B** :
- Suivi du MRR (Monthly Recurring Revenue)
- Coworkings en impayé avec montants dus
- Gestion des plans et des montants mensuels

**Tableau de bord analytique** :
- KPIs globaux de la plateforme avec sélection de période
- MRR, nombre de coworkings actifs, taux d'occupation agrégé
- Top coworkings par CA
- Évolution mensuelle du nombre de coworkings et du MRR
- Rapport intelligent avec anomalies et recommandations à l'échelle plateforme

**Audit log** :
- Historique complet de toutes les actions des super admins
- Traçabilité : qui a fait quoi, quand, sur quel objet

---

### 6.14 Réservation invité (sans compte)

Un système de réservation simplifié pour les visiteurs occasionnels :
- Formulaire public sans création de compte
- Lien de signature de document électronique
- Confirmation par email

---

### 6.15 Tâches automatiques (CRON)

Des tâches planifiées s'exécutent en arrière-plan sans intervention humaine :

| Tâche | Fréquence | Action |
|---|---|---|
| Rappels réservations J-1 | Tous les jours à 18h00 | Email/WhatsApp aux membres concernés |
| Alerte 15 min avant fin | Toutes les 5 minutes | Notification session en cours |
| Clôture sessions expirées | Toutes les 2 minutes | Fermeture automatique + notification |
| Détection dépassements | Toutes les 5 minutes | Alerte dépassement horaire |
| Rappels abonnements J-7 | Tous les jours à 10h00 | Email/WhatsApp renouvellement |
| Rappels abonnements J-3 | Tous les jours à 10h30 | Email/WhatsApp renouvellement urgent |
| Expiration abonnements | Tous les jours à 08h00 | Mise à jour statut + suspension compte |
| Renouvellement automatique | Tous les jours à 06h00 | Création nouvel abonnement + paiement |
| Relances impayés J+3 | Tous les jours à 09h00 | Email rappel paiement |
| Relances impayés J+7 | Tous les jours à 09h00 | Email rappel urgent |
| Suspension impayés J+15 | Tous les jours à 09h00 | Suspension automatique du compte |
| Rappels formations J-1 | Tous les jours à 18h30 | Email/WhatsApp à tous les inscrits |

---

## 7. Points forts et avantages compétitifs

### Tout-en-un
Une seule plateforme gère la totalité des opérations : espaces, membres, réservations, paiements, formations, messagerie, notifications. Aucun outil tiers n'est nécessaire pour le quotidien.

### Zéro friction opérationnelle
Les rappels, relances, confirmations et alertes sont entièrement automatisés. L'équipe du coworking se concentre sur l'accueil, pas sur l'administration.

### Multi-canal de notification
Les membres reçoivent les informations importantes sur le canal qu'ils préfèrent : email ou WhatsApp, configuré une fois dans leur profil.

### Paiement en ligne intégré
Stripe est nativement intégré. Les membres paient en ligne en un clic, l'admin voit le paiement confirmé instantanément, le reçu PDF est généré et envoyé automatiquement.

### Architecture multi-tenant scalable
Un seul déploiement peut gérer des dizaines ou centaines d'espaces de coworking indépendants, chacun avec ses propres données et son équipe, sans interférence.

### Temps réel
La messagerie, les notifications, le timer de session et le tableau de bord s'actualisent en temps réel grâce aux WebSockets. Aucun rafraîchissement manuel nécessaire.

### Rapport intelligent
Le rapport analytique embarqué ne se contente pas d'afficher des chiffres : il analyse les données, détecte les anomalies et formule des recommandations actionnables, comme un consultant disponible 24h/24.

### Déploiement continu
Chaque push sur la branche de production déclenche automatiquement le déploiement sur Vercel (frontend) et Render (backend). Zéro intervention manuelle pour les mises à jour.

### Sécurité en profondeur
JWT + middleware backend + RLS Supabase au niveau DB + isolation tenant : trois couches de sécurité indépendantes protègent les données de chaque coworking.

---

## 8. Flux utilisateur — Parcours type d'un membre

```
1. Inscription
   Formulaire → OTP email → Compte activé → Email de bienvenue

2. Connexion
   Email/mdp ou Google → Vérification statut → Tableau de bord

3. Souscription
   Choix du forfait → Code promo (optionnel) → Abonnement actif

4. Réservation
   Choix espace + horaires → Vérification disponibilité → Choix paiement
   → En attente confirmation admin
   → Admin confirme → Email + Notification + QR Code

5. Accès physique
   Présentation QR Code → Scan par staff → Session démarrée
   → Alerte 15 min avant fin → Fin de session automatique

6. Paiement
   Paiement en ligne Stripe → Reçu PDF automatique
   OU Paiement sur place → Admin valide → Reçu généré
```

---

## 9. Flux utilisateur — Parcours type d'un admin coworking

```
1. Inscription
   Formulaire avec nom du coworking → OTP email → En attente d'approbation Super Admin

2. Approbation
   Super Admin valide → Compte activé → Email de bienvenue

3. Onboarding
   Configuration profil coworking → Ajout des espaces → Configuration tarifs
   → Onboarding complété

4. Opérations quotidiennes
   Tableau de bord KPIs → Validation réservations → Check-in membres
   → Validation paiements → Génération reçus → Messagerie membres

5. Reporting
   Rapport intelligent mensuel → Analyse anomalies → Actions correctives
```

---

## 10. Synthèse des pages de l'application

| Section | Pages |
|---|---|
| **Public** | Landing page, Détail coworking, Login, Register, Mot de passe oublié, Réinitialisation |
| **Membre** | Dashboard, Réservations, Booking (3 étapes), QR Code, Abonnement, Paiements, Formations, Messagerie, Notifications, Profil, Documents, RGPD |
| **Admin** | Dashboard KPIs, Agenda, Réservations, Espaces, Tarification, Paiements, Formations, Formateurs, Multi-sites, Politique annulation, Messagerie, Notifications, Profil coworking, Onboarding |
| **Formateur** | Dashboard, Formations, Planning, Réservations, Paiements, Profil |
| **Super Admin** | Dashboard, Gestion coworkings, Facturation, Utilisateurs, Réservations globales, Paiements globaux, Formations globales, Espaces globaux, Surveillance, Contacts |

**Total : 52 pages** couvrant l'ensemble des besoins métier.

---

*Document généré automatiquement à partir de l'analyse du code source — DeskyWork v1.0*

