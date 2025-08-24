import http.server
import socketserver
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

load_dotenv()


class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None
        self.proxy_index = 0

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

    def run(self):
        # Démarrer le worker
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()

        def handler_factory(*args, **kwargs):
            return Handler(stats_provider=self.stats_provider, api_server=self, *args, **kwargs)

        socketserver.TCPServer.allow_reuse_address = True
        self.server = socketserver.TCPServer((self.host, self.port), handler_factory)

        threading.Timer(1, lambda: webbrowser.open(f'http://{self.host}:{self.port}')).start()

        logger.info(f"🌐 Serveur sur http://{self.host}:{self.port}")
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        logger.info("Arrêt du serveur...")
        self.stop_worker_event.set()
        if self.worker_thread:
            self.worker_thread.join()  # Attendre que le worker termine
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            logger.info("Serveur arrêté.")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, stats_provider=None, api_server=None, **kwargs):
        self.stats_provider = stats_provider
        self.api_server = api_server
        self.routes = {
            'GET': {
                r'/api/data$': self.handle_get_data,
                r'/api/profiles$': self.handle_get_profiles,
                r'/api/profiles/active$': self.handle_get_active_profile,
                r'/api/proxies$': self.handle_get_proxies,
                r'/api/config$': self.handle_get_config,
            },
            'POST': {
                r'/api/profiles$': self.handle_create_profile,
                r'/api/proxies$': self.handle_add_proxy,
                r'/api/participate$': self.handle_participation,
                r'/api/profiles/\d+/activate$': self.handle_activate_profile,
                r'/api/config$': self.handle_save_config,
            },
            'PUT': {
                r'/api/profiles/\d+$': self.handle_update_profile,
            },
            'DELETE': {
                r'/api/profiles/\d+$': self.handle_delete_profile,
                r'/api/proxies$': self.handle_delete_proxy,
            }
        }
        super().__init__(*args, directory='static', **kwargs)

    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        encoded_data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_header('Content-Length', str(len(encoded_data)))
        self.end_headers()
        self.wfile.write(encoded_data)

    def get_json_body(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        return json.loads(post_data)

    def do_GET(self):
        if self.path.startswith('/api/'):
            for pattern, handler in self.routes.get('GET', {}).items():
                if re.match(pattern, self.path):
                    return handler()
            return self.send_json_response(404, {'error': 'Not Found'})

        # Serve static files or the main index.html for the React app
        path = self.translate_path(self.path)
        if not os.path.exists(path):
            self.path = 'index.html'

        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path.startswith('/api/'):
            for pattern, handler in self.routes.get('POST', {}).items():
                if re.match(pattern, self.path):
                    return handler()
            return self.send_json_response(404, {'error': 'Not Found'})
        return self.send_json_response(404, {'error': 'Not Found'})

    def do_PUT(self):
        if self.path.startswith('/api/'):
            for pattern, handler in self.routes.get('PUT', {}).items():
                if re.match(pattern, self.path):
                    return handler()
            return self.send_json_response(404, {'error': 'Not Found'})
        return self.send_json_response(404, {'error': 'Not Found'})

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            for pattern, handler in self.routes.get('DELETE', {}).items():
                if re.match(pattern, self.path):
                    return handler()
            return self.send_json_response(404, {'error': 'Not Found'})
        return self.send_json_response(404, {'error': 'Not Found'})

    # --- Handlers ---
    def handle_get_data(self):
        active_profile = db.get_active_profile()
        if not active_profile:
            return self.send_json_response(404, {'error': 'No active profile found'})
        opportunities = db.get_opportunities(active_profile['id'])
        stats = self.stats_provider() if self.stats_provider else {}
        data = {'opportunities': opportunities, 'stats': stats}
        self.send_json_response(200, data)

    def handle_get_profiles(self):
        profiles = db.get_profiles()
        self.send_json_response(200, profiles)

    def handle_get_active_profile(self):
        profile = db.get_active_profile()
        self.send_json_response(200, profile)

    def handle_get_proxies(self):
        proxies = config_handler.get_proxies()
        self.send_json_response(200, proxies)

    def handle_get_config(self):
        config = config_handler.get_config()
        self.send_json_response(200, config)

    def handle_save_config(self):
        body = self.get_json_body()
        config_handler.save_config(body)
        self.send_json_response(200, {'message': 'Configuration saved successfully'})

    def handle_create_profile(self):
        body = self.get_json_body()
        profile_id = db.create_profile(body['name'], body.get('email'), body.get('userData'), body.get('settings'))
        self.send_json_response(201, {'id': profile_id, 'message': 'Profile created successfully'})

    def handle_activate_profile(self):
        profile_id = int(self.path.split('/')[-2])
        db.set_active_profile(profile_id)
        self.send_json_response(200, {'message': f'Profile {profile_id} activated'})

    def handle_add_proxy(self):
        body = self.get_json_body()
        proxy_url = body.get('proxy_url')
        if not proxy_url:
            return self.send_json_response(400, {'error': 'proxy_url is required'})
        if config_handler.add_proxy(proxy_url):
            self.send_json_response(201, {'message': 'Proxy added successfully'})
        else:
            self.send_json_response(409, {'error': 'Proxy already exists'})

    def handle_update_profile(self):
        profile_id = int(self.path.split('/')[-1])
        body = self.get_json_body()
        db.update_profile(profile_id, body.get('name'), body.get('email'), body.get('userData'), body.get('settings'))
        self.send_json_response(200, {'message': f'Profile {profile_id} updated'})

    def handle_delete_profile(self):
        profile_id = int(self.path.split('/')[-1])
        try:
            db.delete_profile(profile_id)
            self.send_json_response(200, {'message': f'Profile {profile_id} deleted'})
        except ValueError as e:
            self.send_json_response(400, {'error': str(e)})

    def handle_delete_proxy(self):
        body = self.get_json_body()
        proxy_url = body.get('proxy_url')
        if not proxy_url:
            return self.send_json_response(400, {'error': 'proxy_url is required'})
        if config_handler.delete_proxy(proxy_url):
            self.send_json_response(200, {'message': 'Proxy deleted successfully'})
        else:
            self.send_json_response(404, {'error': 'Proxy not found'})

    def handle_participation(self):
        body = self.get_json_body()
        opp_id = body.get('id')

        active_profile = db.get_active_profile()
        if not active_profile:
            return self.send_json_response(400, {'error': 'No active profile to participate with.'})

        opportunity = db.get_opportunity_by_id(opp_id)
        if not opportunity:
            return self.send_json_response(404, {'error': 'Opportunity not found'})

        user_data = json.loads(active_profile['user_data'])
        site_key = opportunity.get('site')
        site_config = self.sites_config.get(site_key, {})
        requires_confirmation = site_config.get('requires_email_confirmation', False)

        job = {
            'id': opp_id,
            'url': opportunity['url'],
            'userData': user_data,
            'requires_email_confirmation': requires_confirmation,
            'profile_id': active_profile['id']
        }
        self.api_server.participation_queue.put(job)
        db.update_opportunity_status(opp_id, 'pending', 'Participation mise en file d\'attente.')
        self.send_json_response(202, {'success': True, 'message': 'Participation en file d\'attente.'})


if __name__ == "__main__":
    # You can customize the stats_provider if needed
    def simple_stats():
        return {"some_stat": 1}

    server = APIServer(stats_provider=simple_stats)
    server.run()
