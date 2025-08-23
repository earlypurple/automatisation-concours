import logging
import sys

def setup_logger():
    """
    Set up the logger for the application.
    """
    # Crée un logger
    logger = logging.getLogger("AppLogger")
    logger.setLevel(logging.DEBUG)  # Capture tous les niveaux de logs

    # Crée un formateur pour les logs
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Handler pour la console (StreamHandler)
    # Affiche les logs de niveau INFO et supérieur sur la console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    # Handler pour le fichier (FileHandler)
    # Écrit les logs de niveau DEBUG et supérieur dans un fichier
    file_handler = logging.FileHandler('server.log', mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # Ajoute les handlers au logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger

# Instance unique du logger pour toute l'application
logger = setup_logger()
