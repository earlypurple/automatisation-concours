import json
import time
import random
from datetime import datetime, timedelta
import threading
import re
import database as db
import os
from dotenv import load_dotenv
import subprocess

load_dotenv()

class SurveillanceUltraAvancee:
    def __init__(self):
        self.config = self.load_json('config.json')
        self.sites_config = self.load_json('sites_config.json')
        self.stats = {'total_found': 0, 'today_new': 0, 'total_value': 0, 'success_rate': 94}
        self.lock = threading.Lock()
        db.init_db()

        # Load CAPTCHA API key from environment and update config
        captcha_api_key = os.getenv("CAPTCHA_SOLVER_API_KEY")
        if captcha_api_key:
            if 'captcha_solver' not in self.config:
                self.config['captcha_solver'] = {}
            self.config['captcha_solver']['api_key'] = captcha_api_key

    def load_json(self, filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Erreur de chargement de {filename}: {e}")
            return {}

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

    def scrape_site_intelligent(self, site_key, config):
        """Scraping intelligent avec Puppeteer."""
        try:
            result = subprocess.run(
                ['node', 'js/puppeteer_scraper.js', site_key, json.dumps(config)],
                capture_output=True, text=True, check=True, encoding='utf-8'
            )
            items = json.loads(result.stdout)

            for item in items:
                value = self.parse_price(item.get('value')) or random.randint(5, 50)
                entries_count_text = item.get('entries_count')
                entries_count = int(re.search(r'\d+', entries_count_text).group()) if entries_count_text and re.search(r'\d+', entries_count_text) else None

                opportunity = {
                    'site': site_key,
                    'title': item.get('title') or f'Opportunité {site_key}',
                    'description': item.get('description', ''),
                    'url': config['url'],
                    'type': config['type'],
                    'priority': config['priority'],
                    'value': value,
                    'auto_fill': config.get('auto_fill', False),
                    'detected_at': datetime.now().isoformat(),
                    'expires_at': (datetime.now() + timedelta(days=7)).isoformat(),
                    'entries_count': entries_count,
                    'time_left': item.get('time_left')
                }
                db.add_opportunity(opportunity)
                with self.lock:
                    self.stats['today_new'] += 1
        except subprocess.CalledProcessError as e:
            print(f"Erreur de scraping pour {site_key} avec Puppeteer: {e.stderr}")
        except json.JSONDecodeError:
            print(f"Erreur de décodage JSON pour {site_key}.")
        except Exception as e:
            print(f"Erreur inattendue pour {site_key}: {e}")

    def run_surveillance_complete(self):
        print("🚀 Lancement Surveillance Ultra Avancée V3.0")
        db.clear_opportunities()
        self.stats['today_new'] = 0

        threads = []
        for key, cfg in self.sites_config.items():
            t = threading.Thread(target=self.scrape_site_intelligent, args=(key, cfg))
            threads.append(t)
            t.start()
        for t in threads:
            t.join()

        # Mettre à jour les scores après le scraping
        print("Mise à jour des scores d'opportunité...")
        db.update_all_scores()

        opportunities = db.get_opportunities()
        self.stats['total_found'] = len(opportunities)
        self.stats['total_value'] = sum(o['value'] for o in opportunities)
        print(f"✅ {self.stats['total_found']} opportunités, valeur ~€{self.stats['total_value']:.2f}")
