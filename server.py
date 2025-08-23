import http.server
import socketserver
import json
import os
import webbrowser
import threading
import database as db
import subprocess
import random

class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None
        self.proxy_index = 0

    def run(self):
        os.chdir(os.path.abspath(os.path.dirname(__file__)))

        def handler_factory(*args, **kwargs):
            # Pass the APIServer instance to the handler to share state (proxy_index)
            return Handler(stats_provider=self.stats_provider, api_server=self, *args, **kwargs)

        self.server = socketserver.TCPServer((self.host, self.port), handler_factory)

        threading.Timer(1, lambda: webbrowser.open(f'http://{self.host}:{self.port}')).start()

        print(f"🌐 Serveur sur http://{self.host}:{self.port}")
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            print("Serveur arrêté.")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, stats_provider=None, api_server=None, **kwargs):
        self.stats_provider = stats_provider
        self.api_server = api_server
        super().__init__(*args, **kwargs)

    def get_proxy(self, proxy_config):
        if not proxy_config.get("enabled") or not proxy_config.get("list"):
            return None

        proxies = proxy_config["list"]
        mode = proxy_config.get("rotation_mode", "random")

        if mode == "random":
            return random.choice(proxies)
        elif mode == "sequential":
            proxy = proxies[self.api_server.proxy_index]
            self.api_server.proxy_index = (self.api_server.proxy_index + 1) % len(proxies)
            return proxy
        return None

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

            url = body.get('url')
            userData = body.get('userData')

            if not url or not userData:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Missing url or userData')
                return

            try:
                with open('config.json', 'r', encoding='utf-8') as f:
                    config = json.load(f)

                puppeteer_config = config.get('puppeteer', {})

                # Handle proxy selection
                proxy_config = config.get('proxies', {})
                selected_proxy = self.get_proxy(proxy_config)
                if selected_proxy:
                    puppeteer_config['proxy'] = selected_proxy

                # Use direct script execution which is more robust
                result = subprocess.run(
                    ['node', 'js/form_filler.js', json.dumps(url), json.dumps(userData), json.dumps(puppeteer_config)],
                    capture_output=True,
                    text=True,
                    check=True,
                    encoding='utf-8'
                )

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(json.loads(result.stdout)).encode('utf-8'))

            except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
                error_message = e.stderr if isinstance(e, subprocess.CalledProcessError) else str(e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': error_message}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
