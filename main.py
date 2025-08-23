#!/usr/bin/env python3
"""
🎯 SYSTÈME ULTRA-AVANCÉ DE SURVEILLANCE GRATUITE V3.0 - Orchestrateur
"""
import time
import threading
import schedule
from scraper import SurveillanceUltraAvancee
from server import APIServer

def run_scheduler(surv_instance):
    """Runs the scheduled tasks."""
    scraping_config = surv_instance.config.get('scraping', {})
    interval = scraping_config.get('interval_minutes', 60)
    start_time = scraping_config.get('start_time', "09:00")

    schedule.every(interval).minutes.do(surv_instance.run_surveillance_complete)
    schedule.every().day.at(start_time).do(surv_instance.run_surveillance_complete)

    print("Planificateur démarré.")
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    # 1. Initialiser le scraper
    surv = SurveillanceUltraAvancee()

    # 2. Lancer la surveillance initiale
    surv.run_surveillance_complete()

    # 3. Démarrer le planificateur dans un thread séparé
    scheduler_thread = threading.Thread(target=run_scheduler, args=(surv,), daemon=True)
    scheduler_thread.start()

    # 4. Démarrer le serveur d'API
    # Le serveur a besoin d'accéder aux stats mises à jour par le scraper
    server = APIServer(
        host=surv.config.get('server', {}).get('host', 'localhost'),
        port=surv.config.get('server', {}).get('port', 8080),
        stats_provider=lambda: surv.stats
    )
    server.run()
