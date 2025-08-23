#!/usr/bin/env python3
"""
🎯 SYSTÈME ULTRA-AVANCÉ DE SURVEILLANCE GRATUITE V3.0 - Orchestrateur
"""
import time
import threading
import schedule
from scraper import SurveillanceUltraAvancee
from server import APIServer

import email_handler

def run_scheduler(surv_instance):
    """Runs the scheduled tasks for scraping."""
    scraping_config = surv_instance.config.get('scraping', {})
    interval = scraping_config.get('interval_minutes', 60)
    schedule.every(interval).minutes.do(surv_instance.run_surveillance_complete)
    print("Planificateur de scraping démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)

def run_email_scheduler(config):
    """Runs the scheduled tasks for email checking."""
    email_config = config.get('email_handler', {})
    interval = email_config.get('check_interval_minutes', 15)
    schedule.every(interval).minutes.do(email_handler.process_pending_confirmations, config=config)
    print("Planificateur d'e-mails démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    # 1. Initialiser le scraper
    surv = SurveillanceUltraAvancee()

    # 2. Lancer la surveillance initiale
    surv.run_surveillance_complete()

    # 3. Démarrer les planificateurs dans des threads séparés
    scraping_scheduler_thread = threading.Thread(target=run_scheduler, args=(surv,), daemon=True)
    scraping_scheduler_thread.start()

    email_scheduler_thread = threading.Thread(target=run_email_scheduler, args=(surv.config,), daemon=True)
    email_scheduler_thread.start()

    # 4. Démarrer le serveur d'API
    # Le serveur a besoin d'accéder aux stats mises à jour par le scraper
    server = APIServer(
        host=surv.config.get('server', {}).get('host', 'localhost'),
        port=surv.config.get('server', {}).get('port', 8080),
        stats_provider=lambda: surv.stats
    )
    server.run()
