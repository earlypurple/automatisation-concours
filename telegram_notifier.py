import requests
from config_handler import config_handler
from logger import logger

def send_telegram_message(message):
    """
    Sends a message to the configured Telegram chat.
    """
    config = config_handler.get_config()
    telegram_config = config.get('notifications', {}).get('telegram', {})

    if not telegram_config.get('enabled'):
        return

    bot_token = telegram_config.get('bot_token')
    chat_id = telegram_config.get('chat_id')

    if not bot_token or not chat_id:
        logger.warning("Telegram bot_token or chat_id is not configured.")
        return

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'Markdown'
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f"Message sent to Telegram: {message}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error sending message to Telegram: {e}")


if __name__ == '__main__':
    # Example usage for testing
    # Make sure to configure your bot_token and chat_id in config.json
    send_telegram_message("Hello from the application!")
