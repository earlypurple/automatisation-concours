import json
import os
import webbrowser
import threading
import queue
import time
import database as db
import random
import re
import requests
from tenacity import retry, stop_after_attempt, wait_exponential
from urllib.parse import urlparse
from dotenv import load_dotenv
from config_handler import config_handler
from logger import logger
from rate_limiter import rate_limiter, rate_limit_decorator
from intelligent_cache import api_cache, analytics_cache
import analytics
from auto_backup import backup_manager
from secure_storage import encrypt_for_storage, decrypt_from_storage
from flask import Flask, jsonify, request, send_from_directory
import psutil

load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')

def check_scraper_status():
    """Vérifie l'état du scraper en testant la connectivité de base"""
    try:
        # Test simple pour vérifier si le module de scraping est accessible
        import scraper
        return 'ok'
    except Exception as e:
        logger.warning(f"Scraper status check failed: {e}")
        return 'degraded'

class APIServer:
    def __init__(self):
        self.proxy_index = 0
        self.start_time = time.time()  # Pour le tracking de l'uptime

        # --- Config & Proxies ---
        self.config = config_handler.get_config()
        self.proxies = config_handler.get_proxies()
        # --------------------------

        # --- Participation Queue ---
        self.participation_queue = queue.Queue()
        self.stop_worker_event = threading.Event()
        self.worker_thread = None
        # --------------------------

    def get_proxy(self):
        # Refresh config and proxies in case they've been updated
        self.config = config_handler.get_config()
        self.proxies = config_handler.get_proxies()

        proxy_config = self.config.get('proxies', {})
        if not proxy_config.get("enabled") or not self.proxies:
            return None

        mode = proxy_config.get("rotation_mode", "random")

        if mode == "random":
            return random.choice(self.proxies)
        elif mode == "sequential":
            if not self.proxies:  # Extra check
                return None
            proxy = self.proxies[self.proxy_index]
            self.proxy_index = (self.proxy_index + 1) % len(self.proxies)
            return proxy
        return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    def _call_scraper(self, url, userData, config):
        logger.info(f"Tentative de participation à {url}...")
        payload = {
            'url': url,
            'userData': userData,
            'config': config
        }
        response = requests.post('http://localhost:3000/fill-form', json=payload, timeout=120)
        response.raise_for_status()
        return response.json()

    def _worker(self):
        logger.info("🤖 Le travailleur de participation est démarré.")
        while not self.stop_worker_event.is_set():
            try:
                job = self.participation_queue.get(timeout=1)

                opp_id = job['id']
                url = job['url']
                userData = job['userData']

                # Logique "Humaine"
                limits = self.config.get('limits', {})
                delay_min = limits.get('delay_seconds_min', 5)
                delay_max = limits.get('delay_seconds_max', 30)
                delay = random.uniform(delay_min, delay_max)

                db.update_opportunity_status(opp_id, 'processing', f"En attente pendant {delay:.1f}s...")
                time.sleep(delay)

                db.update_opportunity_status(opp_id, 'processing', 'Démarrage de la participation via Puppeteer.')

                try:
                    puppeteer_config = self.config.get('puppeteer', {})
                    selected_proxy = self.get_proxy()
                    if selected_proxy:
                        puppeteer_config['proxy'] = selected_proxy

                    result = self._call_scraper(url, userData, puppeteer_config)

                    if result.get('success'):
                        requires_confirmation = job.get('requires_email_confirmation', False)
                        if requires_confirmation:
                            domain = urlparse(url).netloc
                            db.set_confirmation_pending(opp_id, domain)
                        else:
                            db.update_opportunity_status(opp_id, 'success', result.get('message', 'Participation réussie.'))
                        db.add_participation_history(opp_id, 'participated', job['profile_id'])
                    else:
                        db.update_opportunity_status(opp_id, 'failed', result.get('error', 'Une erreur inconnue est survenue.'))
                        db.add_participation_history(opp_id, 'failed', job['profile_id'])

                except Exception as e:
                    logger.error(f"Erreur système inattendue: {e}")
                    db.update_opportunity_status(opp_id, 'failed', f"Erreur système inattendue: {e}")
                    db.add_participation_history(opp_id, 'failed', job['profile_id'])

                self.participation_queue.task_done()

            except queue.Empty:
                continue
        logger.info("🤖 Le travailleur de participation est arrêté.")

    def start_worker(self):
        # Démarrer le worker
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()

    def shutdown(self):
        logger.info("Arrêt du worker...")
        self.stop_worker_event.set()
        if self.worker_thread:
            self.worker_thread.join()  # Attendre que le worker termine
        logger.info("Worker arrêté.")

api_server = APIServer()

def _get_memory_usage():
    """Obtient l'utilisation mémoire si disponible"""
    try:
        process = psutil.Process()
        return {
            'rss_mb': round(process.memory_info().rss / 1024 / 1024, 2),
            'vms_mb': round(process.memory_info().vms / 1024 / 1024, 2)
        }
    except ImportError:
        return {'status': 'unavailable', 'reason': 'psutil not installed'}

@app.route('/api/health', methods=['GET'])
def handle_health_check():
    """Traite les demandes de bilan de santé avec métriques avancées."""
    try:
        db_status = db.check_db_status()
        scraper_status = check_scraper_status()

        # Métriques système avancées
        uptime = time.time() - api_server.start_time if api_server else 0
        queue_size = api_server.participation_queue.qsize() if api_server else 0

        status = {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '4.0.0',
            'services': {
                'api': {'status': 'ok', 'uptime_seconds': uptime},
                'database': {'status': db_status, 'active_profile': db.get_active_profile() is not None},
                'scraper': {'status': scraper_status},
                'queue': {'status': 'ok', 'size': queue_size, 'max_size': 1000}
            },
            'system': {
                'uptime_seconds': uptime,
                'uptime_human': f"{int(uptime//3600)}h {int((uptime%3600)//60)}m",
                'memory_usage': _get_memory_usage(),
                'cache_enabled': True
            }
        }

        # Vérifier si tous les services sont "ok"
        all_services_ok = all(
            service['status'] == 'ok'
            for service in status['services'].values()
        )

        if not all_services_ok:
            status['status'] = 'degraded'

        # Ajouter des alertes si nécessaire
        status['alerts'] = []
        if queue_size > 800:
            status['alerts'].append({
                'level': 'warning',
                'message': f'Queue size high: {queue_size}/1000'
            })

        status_code = 200 if status['status'] == 'healthy' else 503
        return jsonify(status), status_code

    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'error',
            'message': 'Health check failed',
            'error': str(e)
        }), 503

@app.route('/api/data', methods=['GET'])
@rate_limit_decorator('api')
def handle_get_data():
    active_profile = db.get_active_profile()
    if not active_profile:
        return jsonify({'error': 'No active profile found'}), 404

    cache_key = f"opportunities_data_{active_profile['id']}_{request.remote_addr}"
    cached_data = api_cache.get(cache_key)
    if cached_data:
        cached_data['cached'] = True
        return jsonify(cached_data)

    opportunities = db.get_opportunities(active_profile['id'])
    stats = analytics.get_analytics_data(active_profile['id'])

    response_data = {
        'opportunities': opportunities,
        'stats': stats,
        'profile': active_profile,
        'cached': False,
        'timestamp': time.time()
    }

    api_cache.set(cache_key, response_data, ttl=300)

    return jsonify(response_data)

@app.route('/api/profiles', methods=['GET'])
def handle_get_profiles():
    profiles = db.get_profiles()
    return jsonify(profiles)

@app.route('/api/profiles/active', methods=['GET'])
def handle_get_active_profile():
    profile = db.get_active_profile()
    return jsonify(profile)

@app.route('/api/proxies', methods=['GET'])
def handle_get_proxies():
    proxies = config_handler.get_proxies()
    return jsonify(proxies)

@app.route('/api/config', methods=['GET'])
def handle_get_config():
    config = config_handler.get_config()
    return jsonify(config)

@app.route('/api/profiles', methods=['POST'])
def handle_create_profile():
    body = request.get_json()
    profile_id = db.create_profile(body['name'], body.get('email'), body.get('userData'), body.get('settings'))
    return jsonify({'id': profile_id, 'message': 'Profile created successfully'}), 201

@app.route('/api/proxies', methods=['POST'])
def handle_add_proxy():
    body = request.get_json()
    proxy_url = body.get('proxy_url')
    if not proxy_url:
        return jsonify({'error': 'proxy_url is required'}), 400
    if config_handler.add_proxy(proxy_url):
        return jsonify({'message': 'Proxy added successfully'}), 201
    else:
        return jsonify({'error': 'Proxy already exists'}), 409

@app.route('/api/participate', methods=['POST'])
@rate_limit_decorator('heavy')
def handle_participation():
    body = request.get_json()
    opp_id = body.get('id')

    active_profile = db.get_active_profile()
    if not active_profile:
        return jsonify({'error': 'No active profile to participate with.'}), 400

    opportunity = db.get_opportunity_by_id(opp_id)
    if not opportunity:
        return jsonify({'error': 'Opportunity not found'}), 404

    user_data = json.loads(active_profile['user_data'])
    site_key = opportunity.get('site')

    sites_config = config_handler.get_config().get('sites', {})
    site_config = sites_config.get(site_key, {})
    requires_confirmation = site_config.get('requires_email_confirmation', False)

    job = {
        'id': opp_id,
        'url': opportunity['url'],
        'userData': user_data,
        'requires_email_confirmation': requires_confirmation,
        'profile_id': active_profile['id']
    }
    api_server.participation_queue.put(job)
    db.update_opportunity_status(opp_id, 'pending', 'Participation mise en file d\'attente.')

    logger.info(f"Participation queued for opportunity {opp_id} from {request.remote_addr}")

    return jsonify({'success': True, 'message': 'Participation en file d\'attente.'}), 202

@app.route('/api/profiles/<int:profile_id>/activate', methods=['POST'])
def handle_activate_profile(profile_id):
    db.set_active_profile(profile_id)
    return jsonify({'message': f'Profile {profile_id} activated'})

@app.route('/api/config', methods=['POST'])
def handle_save_config():
    body = request.get_json()
    config_handler.save_config(body)
    return jsonify({'message': 'Configuration saved successfully'})

@app.route('/api/profiles/<int:profile_id>', methods=['PUT'])
def handle_update_profile(profile_id):
    body = request.get_json()
    db.update_profile(profile_id, body.get('name'), body.get('email'), body.get('userData'), body.get('settings'))
    return jsonify({'message': f'Profile {profile_id} updated'})

@app.route('/api/profiles/<int:profile_id>', methods=['DELETE'])
def handle_delete_profile(profile_id):
    try:
        db.delete_profile(profile_id)
        return jsonify({'message': f'Profile {profile_id} deleted'})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/proxies', methods=['DELETE'])
def handle_delete_proxy():
    body = request.get_json()
    proxy_url = body.get('proxy_url')
    if not proxy_url:
        return jsonify({'error': 'proxy_url is required'}), 400
    if config_handler.delete_proxy(proxy_url):
        return jsonify({'message': 'Proxy deleted successfully'})
    else:
        return jsonify({'error': 'Proxy not found'}), 404

import atexit
from waitress import serve

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    api_server.start_worker()
    atexit.register(api_server.shutdown)
    serve(app, host='localhost', port=8080)
