# 🎯 Dashboard de Surveillance Gratuite Pro V4.0

Cette nouvelle version majeure intègre des fonctionnalités d'automatisation avancées, le support multi-comptes, et un moteur d'IA pour une gestion quasi-autonome des opportunités.

## Fonctionnalités Clés
- **Gestion Multi-Comptes**: Gérez plusieurs profils de participation, chacun avec ses propres données et statistiques.
- **Scoring d'Opportunité par IA**: Un système de score prédictif qui apprend de vos succès passés pour prioriser les meilleures opportunités.
- **Moteur de Scraping Amélioré**: Utilise un navigateur headless (Playwright) avec des techniques anti-détection pour une meilleure compatibilité.
- **Support CAPTCHA Étendu**: Gère les reCAPTCHA v2, hCaptcha, et les CAPTCHA à base d'images.
- **Gestion de Proxies**: Rotation de proxies pour l'anonymat et pour éviter les blocages.
- **Planification et Limitation Avancées**: Comportement de type humain pour plus de discrétion.
- **Gestion des Confirmations par E-mail**: Un agent qui lit votre boîte mail pour cliquer sur les liens de confirmation.
- **PWA, Temps Réel, Thème Sombre/Clair**, et plus encore.

## Prérequis
- **Pour une exécution locale**: Python 3.9+, Node.js 16+
- **Pour une exécution avec Docker**: Docker et Docker Compose

## Installation (Méthode Recommandée : Docker)
1. Copiez `.env.example` vers `.env` et remplissez vos clés API (ex: `CAPTCHA_SOLVER_API_KEY`).
2. Lancez l'application avec Docker Compose :
   ```bash
   docker compose up --build
   ```
3. Ouvrez votre navigateur sur `http://localhost:8080`.

## Installation (Méthode Manuelle)
1. Installez les dépendances Python : `pip install -r requirements.txt`
2. Installez les dépendances Node.js : `npm install`
3. Configurez le projet en éditant `config.json` et en définissant les variables d'environnement (`.env`).
4. Rendez le script de démarrage exécutable : `chmod +x start_dashboard.sh`
5. Lancez le dashboard : `./start_dashboard.sh`

## Configuration
- La configuration des profils (comptes, données utilisateur) se fait directement dans l'interface web via la page **Paramètres**.
- La configuration globale (proxies, etc.) se trouve dans `config.json`.
- Les clés API et les informations sensibles doivent être placées dans un fichier `.env` à la racine du projet.

## Notes
- La base de données des opportunités est `surveillance.db` (SQLite) et est persistante si vous utilisez Docker grâce à un volume.
- Le mode hors-ligne est disponible grâce au service worker.
