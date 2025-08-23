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
from urllib.parse import urlparse

class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None
        self.proxy_index = 0

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

    def get_proxy(self):
        proxy_config = self.config.get('proxies', {})
        if not proxy_config.get("enabled") or not proxy_config.get("list"):
            return None

        proxies = proxy_config["list"]
        mode = proxy_config.get("rotation_mode", "random")

        if mode == "random":
            return random.choice(proxies)
        elif mode == "sequential":
            proxy = proxies[self.proxy_index]
            self.proxy_index = (self.proxy_index + 1) % len(proxies)
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
                    else:
                        db.update_opportunity_status(opp_id, 'failed', response.get('error', 'Une erreur inconnue est survenue.'))

                except subprocess.CalledProcessError as e:
                    error_output = e.stderr or e.stdout
                    db.update_opportunity_status(opp_id, 'failed', f"Erreur du script: {error_output}")
                except Exception as e:
                    db.update_opportunity_status(opp_id, 'failed', f"Erreur système: {e}")

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

    def do_GET(self):
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            opportunities = db.get_opportunities()
            stats = self.stats_provider() if self.stats_provider else {}
            data = {
                'opportunities': opportunities,
                'stats': stats
            }
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/participate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data)

            opp_id = body.get('id')
            url = body.get('url')
            userData = body.get('userData')

            if not all([opp_id, url, userData]):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': 'Missing id, url, or userData'}).encode('utf-8'))
                return

            # Récupérer les détails de l'opportunité pour la configuration
            opportunity = db.get_opportunity_by_id(opp_id)
            if not opportunity:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': 'Opportunity not found'}).encode('utf-8'))
                return

            site_key = opportunity.get('site')
            site_config = self.sites_config.get(site_key, {})
            requires_confirmation = site_config.get('requires_email_confirmation', False)

            # Mettre en file d'attente
            job = {
                'id': opp_id,
                'url': url,
                'userData': userData,
                'requires_email_confirmation': requires_confirmation
            }
            self.api_server.participation_queue.put(job)

            # Mettre à jour le statut immédiatement
            db.update_opportunity_status(opp_id, 'pending', 'Participation mise en file d\'attente.')

            self.send_response(202) # 202 Accepted
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Participation en file d\'attente.'}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
