# Notes projet (coworking SaaS)

## À faire plus tard — Envoi des emails SMTP (bloqué)

**Sujet :** L'envoi du code de vérification OTP (et tous les autres emails : notifications, reçus, etc.) ne fonctionne pas. Le code apparaît dans le shell du backend mais n'arrive jamais sur le mail de l'utilisateur.

**Cause identifiée :** `backend/.env` contient des valeurs SMTP placeholder non valides :
- `SMTP_USER = votre-email@gmail.com` → compte émetteur inexistant
- `SMTP_PASS` = 30 caractères (un mot de passe d'application Gmail fait 16 caractères)

Donc `otp.routes.js` (ligne 158 : `if (process.env.SMTP_USER && process.env.SMTP_PASS)`) tente l'envoi, l'auth échoue silencieusement (catch lignes 180-182), et le code est loggé dans le shell (ligne 185).

**Solution à faire (quand l'utilisateur fournira) :**
1. Récupérer une adresse Gmail réelle (émettrice).
2. Récupérer le mot de passe d'application (16 car., généré via Google → Sécurité → 2FA → Mots de passe d'application).
3. Mettre à jour `backend/.env` : `SMTP_USER`, `SMTP_PASS`, éventuellement `EMAIL_FROM`.
4. Redémarrer le backend.
5. Tester : créer un compte membre, vérifier que le code OTP arrive bien sur le mail saisi.

**À noter :** la même config SMTP est partagée par tout le backend (`utils/sendEmail.js` + `routes/otp.routes.js`) — corriger `.env` résout tous les envois.

**Attendu par l'utilisateur :** quand il crée un compte membre, le code de vérification doit arriver sur l'email qu'il a saisi dans le formulaire.