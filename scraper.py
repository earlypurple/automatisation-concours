import requests
from bs4 import BeautifulSoup
import json
import time
import random
from datetime import datetime, timedelta
import threading
import re
import database as db

class SurveillanceUltraAvancee:
    def __init__(self):
        self.config = self.load_json('config.json')
        self.sites_config = self.load_json('sites_config.json')
        self.stats = {'total_found': 0, 'today_new': 0, 'total_value': 0, 'success_rate': 94}
        self.lock = threading.Lock()
        db.init_db()

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
        """Scraping intelligent avec sélecteurs CSS."""
        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            resp = requests.get(config['url'], headers=headers, timeout=self.config.get('scraping', {}).get('timeout', 10))
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, 'html.parser')

            selectors = config.get('selectors', {})
            items = soup.select(selectors.get('product', 'body'))

            for item in items:
                # ... existing selectors for title, desc, value ...
                title_selector = selectors.get('title')
                title = item.select_one(title_selector).text.strip() if title_selector and item.select_one(title_selector) else f'Opportunité {site_key}'
                desc_selector = selectors.get('description', 'p')
                desc = item.select_one(desc_selector).text.strip()[:200] if desc_selector and item.select_one(desc_selector) else ''
                value_selector = selectors.get('value')
                value_element = item.select_one(value_selector) if value_selector else None
                price_text = value_element.text.strip() if value_element else None
                value = self.parse_price(price_text) or random.randint(5, 50)

                # New: Scrape entries_count and time_left
                entries_selector = selectors.get('entries_count')
                entries_text = item.select_one(entries_selector).text.strip() if entries_selector and item.select_one(entries_selector) else None
                entries_count = int(re.search(r'\d+', entries_text).group()) if entries_text and re.search(r'\d+', entries_text) else None

                time_left_selector = selectors.get('time_left')
                time_left = item.select_one(time_left_selector).text.strip() if time_left_selector and item.select_one(time_left_selector) else None

                opportunity = {
                    'site': site_key,
                    'title': title,
                    'description': desc,
                    'url': config['url'],
                    'type': config['type'],
                    'priority': config['priority'],
                    'value': value,
                    'auto_fill': config.get('auto_fill', False),
                    'detected_at': datetime.now().isoformat(),
                    'expires_at': (datetime.now() + timedelta(days=7)).isoformat(),
                    'entries_count': entries_count,
                    'time_left': time_left
                }
                db.add_opportunity(opportunity)
                with self.lock:
                    self.stats['today_new'] += 1
        except requests.exceptions.RequestException as e:
            print(f"Erreur de scraping pour {site_key}: {e}")
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
