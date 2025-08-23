import http.server
import socketserver
import json
import os
import webbrowser
import threading
import queue
import time
import database as db
import subprocess
import random
import re
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None
        self.proxy_index = 0
        self.proxies = []

        # --- Participation Queue ---
        self.participation_queue = queue.Queue()
        self.stop_worker_event = threading.Event()
        self.worker_thread = None
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.config = {}
        # --------------------------

        # Load proxies from environment variables
        proxies_list_str = os.getenv("PROXIES_LIST", "[]")
        try:
            self.proxies = json.loads(proxies_list_str)
        except json.JSONDecodeError:
            print("Erreur de décodage de la variable d'environnement PROXIES_LIST.")
            self.proxies = []

    def get_proxy(self):
        proxy_config = self.config.get('proxies', {})
        if not proxy_config.get("enabled") or not self.proxies:
            return None

        mode = proxy_config.get("rotation_mode", "random")

        if mode == "random":
            return random.choice(self.proxies)
        elif mode == "sequential":
            proxy = self.proxies[self.proxy_index]
            self.proxy_index = (self.proxy_index + 1) % len(self.proxies)
            return proxy
        return None

    def _worker(self):
        print("🤖 Le travailleur de participation est démarré.")
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

                    result = subprocess.run(
                        ['node', 'js/form_filler.js', json.dumps(url), json.dumps(userData), json.dumps(puppeteer_config)],
                        capture_output=True, text=True, check=True, encoding='utf-8'
                    )

                    response = json.loads(result.stdout)
                    if response.get('success'):
                        requires_confirmation = job.get('requires_email_confirmation', False)
                        if requires_confirmation:
                            domain = urlparse(url).netloc
                            db.set_confirmation_pending(opp_id, domain)
                        else:
                            db.update_opportunity_status(opp_id, 'success', response.get('message', 'Participation réussie.'))
                        db.add_participation_history(opp_id, 'participated', job['profile_id'])
                    else:
                        db.update_opportunity_status(opp_id, 'failed', response.get('error', 'Une erreur inconnue est survenue.'))
                        db.add_participation_history(opp_id, 'failed', job['profile_id'])

                except subprocess.CalledProcessError as e:
                    error_output = e.stderr or e.stdout
                    db.update_opportunity_status(opp_id, 'failed', f"Erreur du script: {error_output}")
                    db.add_participation_history(opp_id, 'failed', job['profile_id'])
                except Exception as e:
                    db.update_opportunity_status(opp_id, 'failed', f"Erreur système: {e}")
                    db.add_participation_history(opp_id, 'failed', job['profile_id'])

                self.participation_queue.task_done()

            except queue.Empty:
                continue
        print("🤖 Le travailleur de participation est arrêté.")


    def run(self):
        os.chdir(os.path.abspath(os.path.dirname(__file__)))

        # Démarrer le worker
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()

        def handler_factory(*args, **kwargs):
            return Handler(stats_provider=self.stats_provider, api_server=self, *args, **kwargs)

        self.server = socketserver.TCPServer((self.host, self.port), handler_factory)

        threading.Timer(1, lambda: webbrowser.open(f'http://{self.host}:{self.port}')).start()

        print(f"🌐 Serveur sur http://{self.host}:{self.port}")
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        print("Arrêt du serveur...")
        self.stop_worker_event.set()
        if self.worker_thread:
            self.worker_thread.join() # Attendre que le worker termine
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            print("Serveur arrêté.")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, stats_provider=None, api_server=None, **kwargs):
        self.stats_provider = stats_provider
        self.api_server = api_server
        try:
            with open('sites_config.json', 'r', encoding='utf-8') as f:
                self.sites_config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.sites_config = {}
        super().__init__(*args, **kwargs)

    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def get_json_body(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        return json.loads(post_data)

    def handle_api_get(self):
        # --- Routes GET ---
        if self.path == '/api/data':
            active_profile = db.get_active_profile()
            if not active_profile:
                return self.send_json_response(404, {'error': 'No active profile found'})

            opportunities = db.get_opportunities(active_profile['id'])
            stats = self.stats_provider() if self.stats_provider else {}
            data = {'opportunities': opportunities, 'stats': stats}
            self.send_json_response(200, data)

        elif self.path == '/api/profiles':
            profiles = db.get_profiles()
            self.send_json_response(200, profiles)

        elif self.path == '/api/profiles/active':
            profile = db.get_active_profile()
            self.send_json_response(200, profile)

        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def handle_api_post(self):
        # --- Routes POST ---
        if self.path == '/api/participate':
            self.handle_participation()

        elif self.path == '/api/profiles':
            body = self.get_json_body()
            profile_id = db.create_profile(body['name'], body.get('email'), body.get('userData'), body.get('settings'))
            self.send_json_response(201, {'id': profile_id, 'message': 'Profile created successfully'})

        elif re.match(r'/api/profiles/\d+/activate', self.path):
            profile_id = int(self.path.split('/')[-2])
            db.set_active_profile(profile_id)
            self.send_json_response(200, {'message': f'Profile {profile_id} activated'})

        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def handle_api_put(self):
        if re.match(r'/api/profiles/\d+', self.path):
            profile_id = int(self.path.split('/')[-1])
            body = self.get_json_body()
            db.update_profile(profile_id, body.get('name'), body.get('email'), body.get('userData'), body.get('settings'))
            self.send_json_response(200, {'message': f'Profile {profile_id} updated'})
        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def handle_api_delete(self):
        if re.match(r'/api/profiles/\d+', self.path):
            profile_id = int(self.path.split('/')[-1])
            try:
                db.delete_profile(profile_id)
                self.send_json_response(200, {'message': f'Profile {profile_id} deleted'})
            except ValueError as e:
                self.send_json_response(400, {'error': str(e)})
        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.handle_api_get()
        elif self.path == '/settings':
            self.path = '/settings.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self.handle_api_post()
        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def do_PUT(self):
        if self.path.startswith('/api/'):
            self.handle_api_put()
        else:
            self.send_json_response(404, {'error': 'Not Found'})

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self.handle_api_delete()
        else:
            self.send_json_response(404, {'error': 'Not Found'})

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
