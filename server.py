import http.server
import socketserver
import json
import os
import webbrowser
import threading
import database as db

class APIServer:
    def __init__(self, host='localhost', port=8080, stats_provider=None):
        self.host = host
        self.port = port
        self.stats_provider = stats_provider
        self.server = None

    def run(self):
        os.chdir(os.path.abspath(os.path.dirname(__file__)))

        # We need to pass the stats_provider to the handler
        # We can do this by creating a factory function for the handler class
        def handler_factory(*args, **kwargs):
            return Handler(stats_provider=self.stats_provider, *args, **kwargs)

        self.server = socketserver.TCPServer((self.host, self.port), handler_factory)

        # Open the browser in a separate thread
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
    def __init__(self, *args, stats_provider=None, **kwargs):
        self.stats_provider = stats_provider
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
