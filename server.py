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
from rate_limiter import rate_limiter, rate_limit_decorator
from intelligent_cache import api_cache, analytics_cache
from auto_backup import backup_manager
from secure_storage import encrypt_for_storage, decrypt_from_storage

load_dotenv()




class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None
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
                r'/api/health$': self.handle_health_check,
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
        # Rate limiting pour les données
        client_ip = self.client_address[0] if hasattr(self, 'client_address') else 'unknown'
        if not rate_limiter.is_allowed(client_ip, 'api'):
            return self.send_json_response(429, {
                'error': 'Rate limit exceeded',
                'message': 'Too many requests. Please try again later.',
                'retry_after': 60
            })
        
        # Essayer le cache d'abord
        cache_key = f"opportunities_data_{client_ip}"
        cached_data = api_cache.get(cache_key)
        if cached_data:
            cached_data['cached'] = True
            return self.send_json_response(200, cached_data)
        
        active_profile = db.get_active_profile()
        if not active_profile:
            return self.send_json_response(404, {'error': 'No active profile found'})
        
        opportunities = db.get_opportunities(active_profile['id'])
        stats = self.stats_provider() if self.stats_provider else {}
        
        response_data = {
            'opportunities': opportunities,
            'stats': stats,
            'profile': active_profile,
            'cached': False,
            'timestamp': time.time()
        }
        
        # Mettre en cache pour 5 minutes
        api_cache.set(cache_key, response_data, ttl=300)
        
        self.send_json_response(200, response_data)

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

    def handle_health_check(self):
        """Traite les demandes de bilan de santé."""
        db_status = db.check_db_status()
        scraper_status = check_scraper_status()

        status = {
            'api': 'ok',
            'database': db_status,
            'scraper': scraper_status
        }

        # Vérifier si tous les services sont "ok"
        all_ok = all(value == 'ok' for value in status.values())
        status_code = 200 if all_ok else 503

        self.send_json_response(status_code, status)

    def handle_participation(self):
        # Rate limiting strict pour les participations
        client_ip = self.client_address[0] if hasattr(self, 'client_address') else 'unknown'
        if not rate_limiter.is_allowed(client_ip, 'heavy'):
            return self.send_json_response(429, {
                'error': 'Participation rate limit exceeded',
                'message': 'Too many participation requests. Please wait before trying again.',
                'retry_after': 120
            })
        
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
        
        # Log sécurisé
        logger.info(f"Participation queued for opportunity {opp_id} from {client_ip}")
        
        self.send_json_response(202, {'success': True, 'message': 'Participation en file d\'attente.'})

    # --- Nouveaux handlers pour les fonctionnalités avancées ---
    
    def handle_health(self):
        """Endpoint de santé du système avec métriques"""
        client_ip = self.client_address[0] if hasattr(self, 'client_address') else 'unknown'
        
        health_data = {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '4.0.0',
            'services': {
                'database': self._check_database_health(),
                'cache': self._check_cache_health(),
                'backup': self._check_backup_health(),
                'rate_limiter': self._check_rate_limiter_health()
            },
            'system': {
                'uptime': time.time() - self.start_time if hasattr(self, 'start_time') else 0,
                'queue_size': self.participation_queue.qsize(),
                'active_profile': db.get_active_profile() is not None
            }
        }
        
        # Déterminer le statut global
        all_services_ok = all(service['status'] == 'ok' for service in health_data['services'].values())
        if not all_services_ok:
            health_data['status'] = 'degraded'
        
        status_code = 200 if health_data['status'] == 'healthy' else 503
        self.send_json_response(status_code, health_data)

    def handle_cache_stats(self):
        """Statistiques du cache"""
        cache_stats = {
            'api_cache': api_cache.get_stats(),
            'analytics_cache': analytics_cache.get_stats(),
            'total_memory_mb': (api_cache.get_stats()['memory_usage_mb'] + 
                              analytics_cache.get_stats()['memory_usage_mb'])
        }
        self.send_json_response(200, cache_stats)

    def handle_backup_stats(self):
        """Statistiques des sauvegardes"""
        backup_stats = backup_manager.get_backup_stats()
        self.send_json_response(200, backup_stats)

    def handle_create_backup(self):
        """Crée une sauvegarde manuelle"""
        try:
            body = self.get_json_body()
            description = body.get('description', 'Sauvegarde manuelle via API')
            
            backup_path = backup_manager.create_backup('manual', description)
            if backup_path:
                self.send_json_response(201, {
                    'success': True,
                    'message': 'Sauvegarde créée avec succès',
                    'backup_path': backup_path
                })
            else:
                self.send_json_response(500, {'error': 'Échec de la création de la sauvegarde'})
        except Exception as e:
            logger.error(f"Backup creation error: {e}")
            self.send_json_response(500, {'error': 'Erreur interne du serveur'})

    def handle_clear_cache(self):
        """Nettoie le cache"""
        try:
            body = self.get_json_body()
            cache_type = body.get('type', 'all')
            
            if cache_type == 'all' or cache_type == 'api':
                api_cache.clear()
            if cache_type == 'all' or cache_type == 'analytics':
                analytics_cache.clear()
            
            self.send_json_response(200, {
                'success': True,
                'message': f'Cache {cache_type} nettoyé avec succès'
            })
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            self.send_json_response(500, {'error': 'Erreur interne du serveur'})

    # --- Méthodes utilitaires pour le health check ---
    
    def _check_database_health(self):
        try:
            profiles = db.get_profiles()
            return {
                'status': 'ok',
                'profiles_count': len(profiles),
                'has_active_profile': db.get_active_profile() is not None
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    def _check_cache_health(self):
        try:
            api_stats = api_cache.get_stats()
            return {
                'status': 'ok',
                'hit_rate': api_stats['hit_rate_percent'],
                'memory_usage_mb': api_stats['memory_usage_mb']
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    def _check_backup_health(self):
        try:
            backup_stats = backup_manager.get_backup_stats()
            return {
                'status': 'ok',
                'total_backups': backup_stats['total_backups'],
                'auto_enabled': backup_stats['auto_backup_enabled']
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    def _check_rate_limiter_health(self):
        try:
            # Test basique du rate limiter
            test_result = rate_limiter.is_allowed('health_check', 'api')
            return {
                'status': 'ok',
                'test_passed': test_result
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}


if __name__ == "__main__":
    # You can customize the stats_provider if needed
    def simple_stats():
        return {"some_stat": 1}

    server = APIServer(stats_provider=simple_stats)
    server.run()
