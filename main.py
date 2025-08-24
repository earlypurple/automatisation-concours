#!/usr/bin/env python3
"""
🎯 SYSTÈME ULTRA-AVANCÉ DE SURVEILLANCE GRATUITE V3.0 - Orchestrateur
"""
import time
import threading
import schedule
import os
import joblib
import redis
from app import app, api_server
from waitress import serve
import selection_logic
import train_model
from logger import logger

import email_handler
import analytics
import database as db

# --- Gestion du Modèle d'IA ---
MODEL_PATH = 'opportunity_model.joblib'
model_lock = threading.Lock()  # Le modèle est chargé ici et injecté dans les modules qui en ont besoin.
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
                logger.info("🤖 Modèle d'IA chargé avec succès.")
            except Exception as e:
                logger.error(f"⚠️ Erreur lors du chargement du modèle d'IA: {e}")
                model = None
                selection_logic.model = None
        else:
            logger.info("ℹ️ Aucun modèle d'IA trouvé. Le scoring de fallback sera utilisé.")
            model = None
            selection_logic.model = None


def reload_model():
    """Recharge le modèle d'IA pour refléter les changements (ex: ré-entraînement)."""
    logger.info("🔄 Rechargement du modèle d'IA demandé...")
    load_model()


def trigger_scraping_job(r):
    """Envoie un job de scraping à la file d'attente Redis."""
    logger.info("🚀 Envoi d'un job de scraping à la file d'attente...")
    r.publish('scraping_jobs', 'start_scraping')


def run_scheduler(r):
    """Runs the scheduled tasks for scraping."""
    # La configuration de l'intervalle est maintenant lue depuis config.json
    # que le scraper utilisera aussi. C'est une simplification pour l'instant.
    schedule.every(60).minutes.do(trigger_scraping_job, r=r)
    logger.info("Planificateur de scraping démarré. Les jobs seront envoyés à Redis.")
    while True:
        schedule.run_pending()
        time.sleep(1)


def run_training_scheduler(config):
    """Exécute les tâches planifiées pour l'entraînement du modèle d'IA."""
    training_config = config.get('ai_training', {})
    if not training_config.get('enabled', True):
        logger.info("L'entraînement continu de l'IA est désactivé dans la configuration.")
        return

    interval = training_config.get('training_interval_hours', 24)
    if not isinstance(interval, (int, float)) or interval <= 0:
        interval = 24

    logger.info(f"🤖 Planificateur d'entraînement de l'IA démarré. Prochain entraînement dans {interval} heures.")
    schedule.every(interval).hours.do(train_model.train_and_save_model)

    while True:
        schedule.run_pending()
        time.sleep(60)


def run_email_scheduler(config):
    """Runs the scheduled tasks for email checking."""
    email_config = config.get('email_handler', {})
    if not email_config.get('enabled'):
        logger.info("Le gestionnaire d'e-mails est désactivé dans la configuration, le planificateur ne démarrera pas.")
        return
    interval = email_config.get('check_interval_minutes', 15)
    schedule.every(interval).minutes.do(email_handler.process_pending_confirmations, config=config)

    logger.info("Planificateur d'e-mails démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    # 0. Charger le modèle d'IA au démarrage
    load_model()

    # 1. Initialiser le client Redis
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    redis_client = redis.Redis(host=redis_host, port=6379, db=0)

    # 2. Lancer la surveillance initiale
    trigger_scraping_job(redis_client)

    # 3. Démarrer les planificateurs dans des threads séparés
    scraping_scheduler_thread = threading.Thread(target=run_scheduler, args=(redis_client,), daemon=True)
    scraping_scheduler_thread.start()

    # Pour l'instant, on suppose que la config est lue depuis le fichier par les modules.
    # Dans une version plus avancée, on pourrait passer la config via Redis ou autre.
    import config_handler
    app_config = config_handler.load_config()

    email_scheduler_thread = threading.Thread(target=run_email_scheduler, args=(app_config,), daemon=True)
    email_scheduler_thread.start()

    training_scheduler_thread = threading.Thread(target=run_training_scheduler, args=(app_config,), daemon=True)
    training_scheduler_thread.start()

    # 4. Démarrer le serveur d'API
    logger.info("🚀 Démarrage du serveur d'API Flask...")
    api_server.start_worker()
    serve(app, host='0.0.0.0', port=8080)
