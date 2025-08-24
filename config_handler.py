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

        # Overwrite sensitive config with environment variables
        # Captcha
        captcha_config = config.get('captcha_solver', {})
        captcha_config['api_key'] = os.getenv('CAPTCHA_SOLVER_API_KEY')
        config['captcha_solver'] = captcha_config

        # Email
        email_handler_config = config.get('email_handler', {})
        email_handler_config['host'] = os.getenv('EMAIL_HOST')
        email_handler_config['user'] = os.getenv('EMAIL_USER')
        email_handler_config['password'] = os.getenv('EMAIL_PASSWORD')
        config['email_handler'] = email_handler_config

        # Proxies - list is now only from env var
        proxies_config = config.get('proxies', {})
        proxies_list_json = os.getenv('PROXIES_LIST', '[]')
        try:
            proxies_config['list'] = json.loads(proxies_list_json)
        except json.JSONDecodeError:
            logging.error("JSON decoding error for PROXIES_LIST environment variable. Defaulting to empty list.")
            proxies_config['list'] = []
        config['proxies'] = proxies_config

        # Telegram
        notifications_config = config.get('notifications', {})
        telegram_config = notifications_config.get('telegram', {})
        telegram_config['bot_token'] = os.getenv('TELEGRAM_BOT_TOKEN')
        telegram_config['chat_id'] = os.getenv('TELEGRAM_CHAT_ID')
        notifications_config['telegram'] = telegram_config
        config['notifications'] = notifications_config

        return config

    def save_config(self, new_config):
        # We should not save sensitive data that comes from env vars.
        # Create a deep copy to modify.
        import copy
        config_to_save = copy.deepcopy(new_config)

        # Remove sensitive keys before saving
        if 'telegram' in config_to_save.get('notifications', {}):
            config_to_save['notifications']['telegram'].pop('bot_token', None)
            config_to_save['notifications']['telegram'].pop('chat_id', None)
        if 'proxies' in config_to_save:
            config_to_save['proxies'].pop('list', None)
        if 'captcha_solver' in config_to_save:
            config_to_save['captcha_solver'].pop('api_key', None)
        if 'email_handler' in config_to_save:
            config_to_save['email_handler'].pop('host', None)
            config_to_save['email_handler'].pop('user', None)
            config_to_save['email_handler'].pop('password', None)

        with self.lock:
            self.config = config_to_save
            self._save_config()

    def get_proxies(self):
        # This method now gets proxies from the merged config (env vars respected)
        config = self.get_config()
        proxies_config = config.get('proxies', {})
        return proxies_config.get('list', [])

    def get_sites_config(self):
        return self.get_config().get('sites', {})

    def get_site_config(self, site_key):
        return self.get_config().get('sites', {}).get(site_key)

# Singleton instance
config_handler = ConfigHandler()
