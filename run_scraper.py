import redis
import time
from scraper import SurveillanceUltraAvancee
from logger import logger

def main():
    logger.info("🤖 Scraper service démarré. En attente de jobs...")
    redis_host = 'redis'
    r = redis.Redis(host=redis_host, port=6379, db=0, decode_responses=True)

    # Utiliser un Pub/Sub pour écouter les messages
    p = r.pubsub()
    p.subscribe('scraping_jobs')

    while True:
        message = p.get_message()
        if message and message['type'] == 'message':
            logger.info(f"Received job: {message['data']}")
            try:
                # Initialiser et lancer le scraper
                surv = SurveillanceUltraAvancee()
                surv.run_surveillance_complete()
                logger.info("✅ Job de scraping terminé avec succès.")
            except Exception as e:
                logger.error(f"❌ Erreur pendant l'exécution du job de scraping: {e}")
        time.sleep(1)

if __name__ == "__main__":
    main()
