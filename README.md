# 🎯 Dashboard de Surveillance Gratuite Pro V4.0

Cette nouvelle version majeure intègre des fonctionnalités d'automatisation avancées pour une gestion quasi-autonome des opportunités.

## Fonctionnalités
- 🎯 Interface moderne responsive (mobile/desktop)
- 🤖 **Sélection Intelligente des Opportunités**: Un système de score avancé pour prioriser les meilleures opportunités.
-  human **Planification et Limitation Avancées**: Comportement de type humain pour plus de discrétion (délais aléatoires, limites).
- 🧩 **Résolution Automatique des CAPTCHA**: Intégration avec des services de résolution de CAPTCHA (ex: 2Captcha).
- 📧 **Gestion des Confirmations par E-mail**: Un agent qui lit votre boîte mail pour cliquer sur les liens de confirmation.
- 📱 Progressive Web App (PWA) avec service worker.
- 🔄 Auto-actualisation des opportunités.
- 📊 Analyse et statistiques en temps réel.
- 📋 Export JSON/CSV des données.
- 🎨 Thème sombre/clair.

## Prérequis
- Python 3.8 ou supérieur
- Node.js 14 ou supérieur (pour le moteur d'automatisation)
- Un navigateur web moderne (Chrome, Firefox, Safari)

## Installation
1. Clonez ou copiez le dossier du projet.
2. Installez les dépendances Python :
   ```bash
   pip install -r requirements.txt
   ```
3. Installez les dépendances Node.js :
   ```bash
   npm install
   ```
4. Configurez le projet en éditant `config.json` (voir section Configuration).
5. Rendez le script de démarrage exécutable :
   ```bash
   chmod +x start_dashboard.sh
   ```

## Utilisation
1. Lancez le dashboard :
   ```bash
   ./start_dashboard.sh
   ```
2. Le navigateur s'ouvrira automatiquement sur l'interface web (par défaut : http://localhost:8080).

## Configuration
Le fichier `config.json` a été enrichi avec de nouvelles sections pour piloter l'automatisation :

- **`limits`**: Configurez les délais minimum et maximum entre les participations pour simuler un comportement humain.
- **`captcha_solver`**: Activez et configurez votre service de résolution de CAPTCHA.
  - `enabled`: `true` ou `false`.
  - `api_key`: Votre clé API.
- **`email_handler`**: Configurez l'accès à votre boîte mail pour la confirmation automatique.
  - `enabled`: `true` ou `false`.
  - `host`: L'adresse de votre serveur IMAP (ex: `imap.gmail.com`).
  - `user`, `password`: Vos identifiants.
  - `check_interval_minutes`: Fréquence de vérification de la boîte mail.

## Notes
- La base de données des opportunités est maintenant `surveillance.db` (SQLite).
- Le mode hors-ligne est disponible grâce au service worker.
- Assurez-vous de configurer vos informations personnelles pour le remplissage de formulaire dans `app.js` (fonction `getUserData`).
