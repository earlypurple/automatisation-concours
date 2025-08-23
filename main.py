#!/usr/bin/env python3
"""
🎯 SYSTÈME ULTRA-AVANCÉ DE SURVEILLANCE GRATUITE V3.0 - Orchestrateur
"""
import time
import threading
import schedule
import os
import joblib
from scraper import SurveillanceUltraAvancee
from server import APIServer
import selection_logic
import train_model

import email_handler

# --- Gestion du Modèle d'IA ---
MODEL_PATH = 'opportunity_model.joblib'
model_lock = threading.Lock()
# Le modèle est chargé ici et injecté dans les modules qui en ont besoin.
model = None

def load_model():
    """
    Charge le modèle d'IA à partir du fichier.
    Cette fonction est thread-safe.
    """
    global model
    with model_lock:
        if os.path.exists(MODEL_PATH):
            try:
                model = joblib.load(MODEL_PATH)
                selection_logic.model = model  # Injection dans le module de scoring
                print("🤖 Modèle d'IA chargé avec succès.")
            except Exception as e:
                print(f"⚠️ Erreur lors du chargement du modèle d'IA: {e}")
                model = None
                selection_logic.model = None
        else:
            print("ℹ️ Aucun modèle d'IA trouvé. Le scoring de fallback sera utilisé.")
            model = None
            selection_logic.model = None

def reload_model():
    """Recharge le modèle d'IA pour refléter les changements (ex: ré-entraînement)."""
    print("🔄 Rechargement du modèle d'IA demandé...")
    load_model()


def run_scheduler(surv_instance):
    """Runs the scheduled tasks for scraping."""
    scraping_config = surv_instance.config.get('scraping', {})
    interval = scraping_config.get('interval_minutes', 60)
    schedule.every(interval).minutes.do(surv_instance.run_surveillance_complete)
    print("Planificateur de scraping démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)

def run_training_scheduler(config):
    """Exécute les tâches planifiées pour l'entraînement du modèle d'IA."""
    training_config = config.get('ai_training', {})
    if not training_config.get('enabled', True):
        print("L'entraînement continu de l'IA est désactivé dans la configuration.")
        return

    # Mettre une valeur par défaut au cas où la configuration est absente
    interval = training_config.get('training_interval_hours', 24)
    if not isinstance(interval, (int, float)) or interval <= 0:
        interval = 24 # Fallback à une valeur sûre

    print(f"🤖 Planificateur d'entraînement de l'IA démarré. Prochain entraînement dans {interval} heures.")
    # Planifier la première exécution, puis les suivantes
    schedule.every(interval).hours.do(train_model.train_and_save_model)

    while True:
        schedule.run_pending()
        time.sleep(60) # Pas besoin de vérifier chaque seconde

def run_email_scheduler(config):
    """Runs the scheduled tasks for email checking."""
    email_config = config.get('email_handler', {})
    if not email_config.get('enabled'):
        print("Le gestionnaire d'e-mails est désactivé dans la configuration, le planificateur ne démarrera pas.")
        return
    interval = email_config.get('check_interval_minutes', 15)

    # Pass the entire config to the scheduler job
    schedule.every(interval).minutes.do(email_handler.process_pending_confirmations, config=config)

    print("Planificateur d'e-mails démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    # 0. Charger le modèle d'IA au démarrage
    load_model()

    # 1. Initialiser le scraper
    surv = SurveillanceUltraAvancee()

    # 2. Lancer la surveillance initiale
    surv.run_surveillance_complete()

    # 3. Démarrer les planificateurs dans des threads séparés
    scraping_scheduler_thread = threading.Thread(target=run_scheduler, args=(surv,), daemon=True)
    scraping_scheduler_thread.start()

    email_scheduler_thread = threading.Thread(target=run_email_scheduler, args=(surv.config,), daemon=True)
    email_scheduler_thread.start()

    # Nouveau: Démarrer le planificateur d'entraînement de l'IA
    training_scheduler_thread = threading.Thread(target=run_training_scheduler, args=(surv.config,), daemon=True)
    training_scheduler_thread.start()

    # 4. Démarrer le serveur d'API
    # Le serveur a besoin d'accéder aux stats mises à jour par le scraper
    server = APIServer(
        host=surv.config.get('server', {}).get('host', 'localhost'),
        port=surv.config.get('server', {}).get('port', 8080),
        stats_provider=lambda: surv.stats
    )
    server.run()
