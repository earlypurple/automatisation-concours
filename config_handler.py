import json
import threading

class ConfigHandler:
    def __init__(self, config_path='config.json'):
        self.config_path = config_path
        self.lock = threading.Lock()
        self.config = self._load_config()

    def _load_config(self):
        with self.lock:
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                return {}

    def _save_config(self):
        with self.lock:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4)

    def get_config(self):
        return self._load_config()

    def save_config(self, new_config):
        with self.lock:
            self.config = new_config
            self._save_config()

    def get_proxies(self):
        proxies_config = self.config.get('proxies', {})
        return proxies_config.get('list', [])

    def add_proxy(self, proxy_url):
        with self.lock:
            if 'proxies' not in self.config:
                self.config['proxies'] = {'enabled': False, 'rotation_mode': 'random', 'list': []}
            if 'list' not in self.config['proxies']:
                self.config['proxies']['list'] = []

            if proxy_url not in self.config['proxies']['list']:
                self.config['proxies']['list'].append(proxy_url)
                self._save_config()
                return True
            return False

    def delete_proxy(self, proxy_url):
        with self.lock:
            if 'proxies' in self.config and 'list' in self.config['proxies']:
                if proxy_url in self.config['proxies']['list']:
                    self.config['proxies']['list'].remove(proxy_url)
                    self._save_config()
                    return True
            return False

# Singleton instance
config_handler = ConfigHandler()
