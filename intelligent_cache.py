"""
Système de cache intelligent avec expiration automatique et gestion de la mémoire
"""
import time
import json
import hashlib
import threading
from collections import OrderedDict
from typing import Any, Optional, Dict, List
from logger import logger


class IntelligentCache:
    """
    Cache intelligent avec:
    - Expiration automatique des données
    - LRU (Least Recently Used) eviction
    - Gestion de la mémoire
    - Compression automatique
    - Persistance optionnelle
    """
    
    def __init__(self, 
                 max_size: int = 1000,
                 default_ttl: int = 3600,  # 1 heure par défaut
                 max_memory_mb: int = 100,
                 enable_persistence: bool = False,
                 persistence_file: str = 'cache_data.json'):
        
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.enable_persistence = enable_persistence
        self.persistence_file = persistence_file
        
        # Cache principal avec ordre d'accès
        self._cache = OrderedDict()
        self._lock = threading.RLock()
        
        # Métadonnées pour chaque entrée
        self._metadata = {}
        
        # Statistiques
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'memory_usage': 0,
            'last_cleanup': time.time()
        }
        
        # Thread de nettoyage automatique
        self._cleanup_thread = threading.Thread(target=self._cleanup_worker, daemon=True)
        self._cleanup_running = True
        self._cleanup_thread.start()
        
        # Charger depuis la persistance si activée
        if self.enable_persistence:
            self._load_from_persistence()

    def get(self, key: str, default: Any = None) -> Any:
        """
        Récupère une valeur du cache
        """
        with self._lock:
            current_time = time.time()
            
            if key not in self._cache:
                self._stats['misses'] += 1
                return default
            
            # Vérifier l'expiration
            metadata = self._metadata.get(key, {})
            if metadata.get('expires_at', float('inf')) < current_time:
                self._remove_expired(key)
                self._stats['misses'] += 1
                return default
            
            # Déplacer vers la fin (LRU)
            value = self._cache.pop(key)
            self._cache[key] = value
            
            # Mettre à jour les métadonnées d'accès
            metadata['last_accessed'] = current_time
            metadata['access_count'] = metadata.get('access_count', 0) + 1
            
            self._stats['hits'] += 1
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Stocke une valeur dans le cache
        """
        with self._lock:
            current_time = time.time()
            ttl = ttl if ttl is not None else self.default_ttl
            
            # Calculer la taille approximative
            value_size = self._estimate_size(value)
            
            # Vérifier si l'ajout dépasserait la limite mémoire
            if self._stats['memory_usage'] + value_size > self.max_memory_bytes:
                if not self._free_memory(value_size):
                    logger.warning(f"Cache: Impossible d'ajouter {key}, mémoire insuffisante")
                    return False
            
            # Supprimer l'ancienne entrée si elle existe
            if key in self._cache:
                old_size = self._metadata[key].get('size', 0)
                self._stats['memory_usage'] -= old_size
            
            # Ajouter/mettre à jour l'entrée
            self._cache[key] = value
            self._metadata[key] = {
                'created_at': current_time,
                'expires_at': current_time + ttl,
                'last_accessed': current_time,
                'access_count': 1,
                'size': value_size,
                'ttl': ttl
            }
            
            self._stats['memory_usage'] += value_size
            
            # Éviction si nécessaire
            if len(self._cache) > self.max_size:
                self._evict_lru()
            
            return True

    def delete(self, key: str) -> bool:
        """
        Supprime une entrée du cache
        """
        with self._lock:
            if key in self._cache:
                self._remove_key(key)
                return True
            return False

    def clear(self):
        """
        Vide complètement le cache
        """
        with self._lock:
            self._cache.clear()
            self._metadata.clear()
            self._stats['memory_usage'] = 0
            self._stats['evictions'] = 0

    def get_stats(self) -> Dict[str, Any]:
        """
        Retourne les statistiques du cache
        """
        with self._lock:
            hit_rate = 0
            total_requests = self._stats['hits'] + self._stats['misses']
            if total_requests > 0:
                hit_rate = (self._stats['hits'] / total_requests) * 100
            
            return {
                'size': len(self._cache),
                'max_size': self.max_size,
                'memory_usage_mb': self._stats['memory_usage'] / (1024 * 1024),
                'max_memory_mb': self.max_memory_bytes / (1024 * 1024),
                'hit_rate_percent': round(hit_rate, 2),
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'evictions': self._stats['evictions'],
                'expired_items': self._count_expired()
            }

    def get_keys(self, pattern: str = None) -> List[str]:
        """
        Retourne la liste des clés (optionnellement filtrées)
        """
        with self._lock:
            keys = list(self._cache.keys())
            if pattern:
                import re
                regex = re.compile(pattern)
                keys = [k for k in keys if regex.search(k)]
            return keys

    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalide toutes les clés correspondant au pattern
        """
        import re
        regex = re.compile(pattern)
        
        with self._lock:
            keys_to_remove = [k for k in self._cache.keys() if regex.search(k)]
            for key in keys_to_remove:
                self._remove_key(key)
            return len(keys_to_remove)

    def _estimate_size(self, value: Any) -> int:
        """
        Estime la taille d'une valeur en mémoire
        """
        try:
            if isinstance(value, (str, bytes)):
                return len(value)
            elif isinstance(value, (dict, list)):
                return len(json.dumps(value, default=str))
            else:
                return len(str(value))
        except:
            return 1024  # Taille par défaut

    def _free_memory(self, required_bytes: int) -> bool:
        """
        Libère de la mémoire en supprimant les entrées les moins utilisées
        """
        freed = 0
        current_time = time.time()
        
        # D'abord supprimer les entrées expirées
        expired_keys = []
        for key, metadata in self._metadata.items():
            if metadata.get('expires_at', float('inf')) < current_time:
                expired_keys.append(key)
        
        for key in expired_keys:
            freed += self._metadata[key].get('size', 0)
            self._remove_expired(key)
            if freed >= required_bytes:
                return True
        
        # Ensuite, supprimer les entrées LRU
        while freed < required_bytes and self._cache:
            oldest_key = next(iter(self._cache))
            freed += self._metadata[oldest_key].get('size', 0)
            self._remove_key(oldest_key)
        
        return freed >= required_bytes

    def _evict_lru(self):
        """
        Éviction LRU (Least Recently Used)
        """
        if self._cache:
            oldest_key = next(iter(self._cache))
            self._remove_key(oldest_key)
            self._stats['evictions'] += 1

    def _remove_key(self, key: str):
        """
        Supprime une clé et met à jour les statistiques
        """
        if key in self._cache:
            del self._cache[key]
        if key in self._metadata:
            self._stats['memory_usage'] -= self._metadata[key].get('size', 0)
            del self._metadata[key]

    def _remove_expired(self, key: str):
        """
        Supprime une entrée expirée
        """
        self._remove_key(key)

    def _count_expired(self) -> int:
        """
        Compte les entrées expirées
        """
        current_time = time.time()
        return sum(1 for metadata in self._metadata.values() 
                  if metadata.get('expires_at', float('inf')) < current_time)

    def _cleanup_worker(self):
        """
        Thread de nettoyage automatique
        """
        while self._cleanup_running:
            try:
                time.sleep(300)  # Nettoyage toutes les 5 minutes
                self.cleanup_expired()
                
                # Sauvegarder si persistance activée
                if self.enable_persistence:
                    self._save_to_persistence()
                    
            except Exception as e:
                logger.error(f"Cache cleanup error: {e}")

    def cleanup_expired(self) -> int:
        """
        Nettoie les entrées expirées
        """
        with self._lock:
            current_time = time.time()
            expired_keys = []
            
            for key, metadata in self._metadata.items():
                if metadata.get('expires_at', float('inf')) < current_time:
                    expired_keys.append(key)
            
            for key in expired_keys:
                self._remove_expired(key)
            
            self._stats['last_cleanup'] = current_time
            
            if expired_keys:
                logger.info(f"Cache: Supprimé {len(expired_keys)} entrées expirées")
            
            return len(expired_keys)

    def _save_to_persistence(self):
        """
        Sauvegarde le cache sur disque
        """
        if not self.enable_persistence:
            return
        
        try:
            with self._lock:
                # Sauvegarder seulement les entrées non expirées
                current_time = time.time()
                cache_data = {}
                
                for key, value in self._cache.items():
                    metadata = self._metadata.get(key, {})
                    if metadata.get('expires_at', float('inf')) > current_time:
                        cache_data[key] = {
                            'value': value,
                            'metadata': metadata
                        }
                
                with open(self.persistence_file, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, default=str, ensure_ascii=False)
                    
        except Exception as e:
            logger.error(f"Cache persistence save error: {e}")

    def _load_from_persistence(self):
        """
        Charge le cache depuis le disque
        """
        try:
            with open(self.persistence_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            current_time = time.time()
            loaded_count = 0
            
            with self._lock:
                for key, data in cache_data.items():
                    metadata = data.get('metadata', {})
                    
                    # Vérifier si pas expiré
                    if metadata.get('expires_at', float('inf')) > current_time:
                        self._cache[key] = data['value']
                        self._metadata[key] = metadata
                        self._stats['memory_usage'] += metadata.get('size', 0)
                        loaded_count += 1
            
            logger.info(f"Cache: Chargé {loaded_count} entrées depuis la persistance")
            
        except FileNotFoundError:
            logger.info("Cache: Aucun fichier de persistance trouvé")
        except Exception as e:
            logger.error(f"Cache persistence load error: {e}")

    def shutdown(self):
        """
        Arrêt propre du cache
        """
        self._cleanup_running = False
        if self._cleanup_thread.is_alive():
            self._cleanup_thread.join(timeout=1)
        
        if self.enable_persistence:
            self._save_to_persistence()


# Instances globales pour différents types de cache
api_cache = IntelligentCache(
    max_size=500,
    default_ttl=300,  # 5 minutes pour l'API
    max_memory_mb=50,
    enable_persistence=True,
    persistence_file='api_cache.json'
)

analytics_cache = IntelligentCache(
    max_size=100,
    default_ttl=1800,  # 30 minutes pour analytics
    max_memory_mb=25,
    enable_persistence=True,
    persistence_file='analytics_cache.json'
)

user_data_cache = IntelligentCache(
    max_size=200,
    default_ttl=86400,  # 24 heures pour données utilisateur
    max_memory_mb=25,
    enable_persistence=True,
    persistence_file='user_cache.json'
)


def get_cache_by_type(cache_type: str) -> IntelligentCache:
    """
    Retourne le cache approprié selon le type
    """
    caches = {
        'api': api_cache,
        'analytics': analytics_cache,
        'user': user_data_cache
    }
    return caches.get(cache_type, api_cache)


def cache_decorator(cache_type: str = 'api', ttl: int = None):
    """
    Décorateur pour mettre en cache le résultat d'une fonction
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            cache = get_cache_by_type(cache_type)
            
            # Créer une clé unique basée sur la fonction et ses arguments
            key_parts = [func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            
            cache_key = hashlib.md5('|'.join(key_parts).encode()).hexdigest()
            
            # Essayer de récupérer du cache
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # Exécuter la fonction et mettre en cache
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator