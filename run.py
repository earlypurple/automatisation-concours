import os
from server import APIServer
import analytics
import database as db
from config_handler import ConfigHandler

def main():
    # Load application configuration
    config_handler_instance = ConfigHandler()
    app_config = config_handler_instance.get_config()
    server_config = app_config.get('server', {})
    host = server_config.get('host', '0.0.0.0')
    port = server_config.get('port', 8080)

    # Initialize the APIServer
    api_server = APIServer(
        host=host,
        port=port
    )

    # Run the server
    api_server.run()

if __name__ == '__main__':
    main()
