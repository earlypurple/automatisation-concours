import json
import threading
import os
import logging

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
        config = self._load_config()

        # Merge with environment variables for secrets
        # Captcha
        captcha_config = config.get('captcha_solver', {})
        captcha_config['api_key'] = os.getenv('CAPTCHA_SOLVER_API_KEY', captcha_config.get('api_key'))
        config['captcha_solver'] = captcha_config

        # Email
        email_handler_config = config.get('email_handler', {})
        email_handler_config['host'] = os.getenv('EMAIL_HOST', email_handler_config.get('host'))
        email_handler_config['user'] = os.getenv('EMAIL_USER', email_handler_config.get('user'))
        email_handler_config['password'] = os.getenv('EMAIL_PASSWORD', email_handler_config.get('password'))
        config['email_handler'] = email_handler_config

        # Proxies
        proxies_config = config.get('proxies', {})
        proxies_list_json = os.getenv('PROXIES_LIST')
        if proxies_list_json:
            try:
                proxies_config['list'] = json.loads(proxies_list_json)
            except json.JSONDecodeError:
                logging.error("JSON decoding error for PROXIES_LIST environment variable.")
        config['proxies'] = proxies_config

        # Telegram
        notifications_config = config.get('notifications', {})
        telegram_config = notifications_config.get('telegram', {})
        telegram_config['bot_token'] = os.getenv('TELEGRAM_BOT_TOKEN', telegram_config.get('bot_token'))
        telegram_config['chat_id'] = os.getenv('TELEGRAM_CHAT_ID', telegram_config.get('chat_id'))
        notifications_config['telegram'] = telegram_config
        config['notifications'] = notifications_config

        return config

    def save_config(self, new_config):
        with self.lock:
            self.config = new_config
            self._save_config()

    def get_proxies(self):
        config = self.get_config()
        proxies_config = config.get('proxies', {})
        return proxies_config.get('list', [])

    def get_sites_config(self):
        return self.get_config().get('sites', {})

    def get_site_config(self, site_key):
        return self.get_config().get('sites', {}).get(site_key)

    def add_proxy(self, proxy_url):
        with self.lock:
            # Load the raw config from disk to modify it
            raw_config = self._load_config()
            if 'proxies' not in raw_config:
                raw_config['proxies'] = {'enabled': False, 'rotation_mode': 'random', 'list': []}
            if 'list' not in raw_config['proxies']:
                raw_config['proxies']['list'] = []

            if proxy_url not in raw_config['proxies']['list']:
                raw_config['proxies']['list'].append(proxy_url)
                self.config = raw_config
                self._save_config()
                return True
            return False

    def delete_proxy(self, proxy_url):
        with self.lock:
            # Load the raw config from disk to modify it
            raw_config = self._load_config()
            if 'proxies' in raw_config and 'list' in raw_config['proxies']:
                if proxy_url in raw_config['proxies']['list']:
                    raw_config['proxies']['list'].remove(proxy_url)
                    self.config = raw_config
                    self._save_config()
                    return True
            return False

# Singleton instance
config_handler = ConfigHandler()
