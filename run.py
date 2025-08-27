import uvicorn
from api import app
from config_handler import ConfigHandler

def main():
    print("Starting server...")
    # Load application configuration
    config_handler_instance = ConfigHandler()
    app_config = config_handler_instance.get_config()
    server_config = app_config.get('server', {})
    host = server_config.get('host', '0.0.0.0')
    port = server_config.get('port', 8080)

    # Run the FastAPI server
    uvicorn.run(app, host=host, port=port)

if __name__ == '__main__':
    main()
