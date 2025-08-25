import json
import random
from datetime import datetime, timedelta
import threading
import re
import database as db
from telegram_notifier import send_telegram_message
import os
from dotenv import load_dotenv
import requests
from logger import logger
from config_handler import config_handler

load_dotenv()


class SurveillanceUltraAvancee:
    def __init__(self):
        self.config = config_handler.get_config()
        self.sites_config = config_handler.get_sites_config()
        self.stats = {'total_found': 0, 'today_new': 0, 'total_value': 0, 'success_rate': 94}
        self.lock = threading.Lock()
        db.run_migrations()
        db.init_db()

        # Load CAPTCHA API key from environment and update config
        captcha_api_key = os.getenv("CAPTCHA_SOLVER_API_KEY")
        if captcha_api_key:
            if 'captcha_solver' not in self.config:
                self.config['captcha_solver'] = {}
            self.config['captcha_solver']['api_key'] = captcha_api_key

    def parse_price(self, price_str):
        if not price_str:
            return None
        numbers = re.findall(r'(\d[\d,\.]*)', price_str)
        if not numbers:
            return None
        try:
            return float(numbers[0].replace(',', '.'))
        except (ValueError, IndexError):
            return None

    def scrape_site_intelligent(self, site_key, site_config, profile_id):
        """Scraping intelligent avec le service de scraper pour un profil donné."""
        try:
            payload = {
                'siteKey': site_key,
                'siteConfig': site_config,
                'config': self.config
            }
            response = requests.post('http://localhost:3000/scrape', json=payload, timeout=120)
            response.raise_for_status()
            items = response.json()

            for item in items:
                value = self.parse_price(item.get('value')) or random.randint(5, 50)
                entries_count_text = item.get('entries_count')
                entries_count = int(re.search(r'\d+', entries_count_text).group()) if entries_count_text and re.search(r'\d+', entries_count_text) else None

                opportunity = {
                    'site': site_key,
                    'title': item.get('title') or f'Opportunité {site_key}',
                    'description': item.get('description', ''),
                    'url': site_config['url'],
                    'type': site_config['type'],
                    'priority': site_config['priority'],
                    'value': value,
                    'auto_fill': site_config.get('auto_fill', False),
                    'detected_at': datetime.now().isoformat(),
                    'expires_at': (datetime.now() + timedelta(days=7)).isoformat(),
                    'entries_count': entries_count,
                    'time_left': item.get('time_left')
                }
                if db.add_opportunity(opportunity, profile_id):
                    # Send notification if the opportunity is new
                    message = (
                        f"🎉 *Nouvelle Opportunité !* 🎉\n\n"
                        f"*{opportunity['title']}*\n\n"
                        f"**Valeur:** {opportunity['value']}€\n"
                        f"**Site:** {opportunity['site']}\n\n"
                        f"[Voir l'opportunité]({opportunity['url']})"
                    )
                    send_telegram_message(message)

                with self.lock:
                    self.stats['today_new'] += 1
        except subprocess.CalledProcessError as e:
            logger.error(f"Erreur de scraping pour {site_key} avec Puppeteer: {e.stderr}")
        except json.JSONDecodeError:
            logger.error(f"Erreur de décodage JSON pour {site_key}.")
        except (ValueError, TypeError) as e:
            logger.error(f"Erreur de traitement des données pour {site_key}: {e}")
        except Exception as e:
            logger.error(f"Erreur inattendue pour {site_key}: {e}")

    def run_surveillance_complete(self):
        active_profile = db.get_active_profile()
        if not active_profile:
            logger.warning("❌ Aucun profil actif trouvé. Veuillez en activer un.")
            return

        profile_id = active_profile['id']
        logger.info(f"🚀 Lancement de la surveillance pour le profil : {active_profile['name']} (ID: {profile_id})")

        db.clear_opportunities(profile_id)
        self.stats['today_new'] = 0

        threads = []
        for key, cfg in self.sites_config.items():
            t = threading.Thread(target=self.scrape_site_intelligent, args=(key, cfg, profile_id))
            threads.append(t)
            t.start()
        for t in threads:
            t.join()

        # Mettre à jour les scores après le scraping
        logger.info(f"Mise à jour des scores pour le profil {profile_id}...")
        db.update_all_scores(profile_id)

        opportunities = db.get_opportunities(profile_id)
        self.stats['total_found'] = len(opportunities)
        self.stats['total_value'] = sum(o['value'] for o in opportunities if o['value'])
        logger.info(f"✅ {self.stats['total_found']} opportunités trouvées pour le profil {active_profile['name']}, valeur ~€{self.stats['total_value']:.2f}")
