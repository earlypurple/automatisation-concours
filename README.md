# Dashboard Surveillance Gratuite Pro V3.0

## Fonctionnalités
- 🎯 Interface moderne responsive (mobile/desktop)
- 🤖 Intelligence Artificielle pour détection automatique
- 📱 Progressive Web App (PWA) avec service worker
- 🔄 Auto-update toutes les heures
- 📊 Analyse et statistiques temps réel
- 📋 Export JSON des données
- 🔔 Notifications toast
- 🎨 Thème sombre/clair
- 📈 Analytics et tracking des participations

## Prérequis
- Python 3.8 ou supérieur
- Un navigateur web moderne (Chrome, Firefox, Safari)

## Installation
1. Cloner ou copier le dossier dans `~/SurveillanceGratuite-Pro`
2. Installer les dépendances Python :
   ```bash
   cd ~/SurveillanceGratuite-Pro
   pip install -r requirements.txt
   ```
3. Rendre le script de démarrage exécutable :
   ```bash
   chmod +x start_dashboard.sh
   ```

## Utilisation
1. Lancer le dashboard :
   ```bash
   ./start_dashboard.sh
   ```
2. Le navigateur s'ouvrira automatiquement sur http://localhost:8080

## Notes
- Le dashboard s'auto-actualise toutes les heures
- Les données sont sauvegardées dans surveillance_data.json
- Mode hors-ligne disponible grâce au service worker
