"""
Module de limitation de débit pour prévenir les attaques et protéger l'API
"""
import time
import threading
from collections import defaultdict, deque
from logger import logger


class RateLimiter:
    """
    Limiteur de débit flexible avec fenêtre glissante
    """
    
    def __init__(self):
        self.clients = defaultdict(lambda: {
            'requests': deque(),
            'blocked_until': 0
        })
        self.lock = threading.Lock()
        
        # Configuration par défaut
        self.limits = {
            'api': {'requests': 100, 'window': 60},     # 100 req/min pour API générale
            'scraping': {'requests': 10, 'window': 60}, # 10 req/min pour scraping
            'auth': {'requests': 5, 'window': 300},     # 5 req/5min pour auth
            'heavy': {'requests': 5, 'window': 60}      # 5 req/min pour opérations lourdes
        }

    def is_allowed(self, client_id, endpoint_type='api'):
        """
        Vérifie si une requête est autorisée pour un client donné
        
        Args:
            client_id (str): Identifiant unique du client (IP, user_id, etc.)
            endpoint_type (str): Type d'endpoint ('api', 'scraping', 'auth', 'heavy')
            
        Returns:
            bool: True si la requête est autorisée, False sinon
        """
        current_time = time.time()
        
        with self.lock:
            client_data = self.clients[client_id]
            
            # Vérifier si le client est bloqué
            if current_time < client_data['blocked_until']:
                logger.warning(f"Rate limit: Client {client_id} still blocked until {client_data['blocked_until']}")
                return False
            
            # Récupérer les limites pour ce type d'endpoint
            limit_config = self.limits.get(endpoint_type, self.limits['api'])
            max_requests = limit_config['requests']
            window_size = limit_config['window']
            
            # Nettoyer les anciennes requêtes hors de la fenêtre
            requests_queue = client_data['requests']
            cutoff_time = current_time - window_size
            
            while requests_queue and requests_queue[0] < cutoff_time:
                requests_queue.popleft()
            
            # Vérifier si la limite est atteinte
            if len(requests_queue) >= max_requests:
                # Bloquer le client pour 2x la fenêtre
                client_data['blocked_until'] = current_time + (window_size * 2)
                logger.warning(f"Rate limit exceeded for {client_id} on {endpoint_type}: {len(requests_queue)}/{max_requests}")
                return False
            
            # Ajouter la requête actuelle
            requests_queue.append(current_time)
            
            # Log pour surveillance
            if len(requests_queue) > max_requests * 0.8:  # 80% de la limite
                logger.info(f"Rate limit warning: {client_id} approaching limit on {endpoint_type}: {len(requests_queue)}/{max_requests}")
            
            return True

    def get_client_status(self, client_id):
        """
        Retourne le statut actuel d'un client
        
        Returns:
            dict: Statut avec informations sur les requêtes et blocages
        """
        current_time = time.time()
        
        with self.lock:
            client_data = self.clients[client_id]
            
            status = {
                'blocked': current_time < client_data['blocked_until'],
                'blocked_until': client_data['blocked_until'],
                'recent_requests': {}
            }
            
            # Compter les requêtes récentes par type
            for endpoint_type, limit_config in self.limits.items():
                window_size = limit_config['window']
                cutoff_time = current_time - window_size
                
                # Compter les requêtes dans la fenêtre
                recent_count = sum(1 for req_time in client_data['requests'] if req_time > cutoff_time)
                
                status['recent_requests'][endpoint_type] = {
                    'count': recent_count,
                    'limit': limit_config['requests'],
                    'window': window_size
                }
            
            return status

    def clear_client(self, client_id):
        """
        Efface l'historique d'un client (pour déblocage manuel)
        """
        with self.lock:
            if client_id in self.clients:
                del self.clients[client_id]
                logger.info(f"Rate limiter: Cleared history for client {client_id}")

    def update_limits(self, endpoint_type, requests, window):
        """
        Met à jour les limites pour un type d'endpoint
        """
        if endpoint_type in self.limits:
            self.limits[endpoint_type] = {'requests': requests, 'window': window}
            logger.info(f"Rate limiter: Updated limits for {endpoint_type}: {requests} req/{window}s")


# Instance globale
rate_limiter = RateLimiter()


def rate_limit_decorator(endpoint_type='api'):
    """
    Décorateur pour appliquer automatiquement la limitation de débit
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Essayer d'extraire l'IP de la requête Flask
            client_id = 'default'
            try:
                from flask import request
                client_id = request.remote_addr or 'unknown'
            except:
                pass
            
            if not rate_limiter.is_allowed(client_id, endpoint_type):
                from flask import jsonify
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': 'Too many requests. Please try again later.',
                    'retry_after': 60
                }), 429
            
            return func(*args, **kwargs)
        
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator


# Fonctions utilitaires pour JavaScript
def create_client_rate_limiter(max_requests_per_minute=30):
    """
    Crée un limiteur de débit côté client pour JavaScript
    """
    return {
        'max_requests': max_requests_per_minute,
        'window': 60,  # 1 minute
        'requests': [],
        'last_cleanup': time.time()
    }


def check_client_rate_limit(client_limiter):
    """
    Vérifie le rate limit côté client (à utiliser dans du code JavaScript/Python hybride)
    """
    current_time = time.time()
    
    # Nettoyer les anciennes requêtes
    if current_time - client_limiter['last_cleanup'] > 10:  # Nettoyer toutes les 10 secondes
        cutoff = current_time - client_limiter['window']
        client_limiter['requests'] = [req for req in client_limiter['requests'] if req > cutoff]
        client_limiter['last_cleanup'] = current_time
    
    # Vérifier la limite
    if len(client_limiter['requests']) >= client_limiter['max_requests']:
        return False
    
    # Ajouter la requête actuelle
    client_limiter['requests'].append(current_time)
    return True