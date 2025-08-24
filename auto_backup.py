"""
Système de sauvegarde automatique avec rotation et compression
"""
import os
import shutil
import time
import gzip
import json
import sqlite3
import schedule
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
from logger import logger


class AutoBackupManager:
    """
    Gestionnaire de sauvegardes automatiques avec:
    - Sauvegarde de la base de données
    - Sauvegarde des fichiers de configuration
    - Compression automatique
    - Rotation des sauvegardes anciennes
    - Restauration en un clic
    """
    
    def __init__(self, backup_dir: str = 'backups'):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Configuration par défaut
        self.config = {
            'enabled': True,
            'daily_backups': True,
            'weekly_backups': True,
            'monthly_backups': True,
            'keep_daily': 7,       # Garder 7 sauvegardes quotidiennes
            'keep_weekly': 4,      # Garder 4 sauvegardes hebdomadaires
            'keep_monthly': 12,    # Garder 12 sauvegardes mensuelles
            'compression': True,
            'max_backup_size_mb': 500,
            'schedule_time': '02:00'  # 2h du matin
        }
        
        # Fichiers à sauvegarder
        self.backup_targets = {
            'database': 'surveillance.db',
            'config': 'config.json',
            'cache': ['api_cache.json', 'analytics_cache.json', 'user_cache.json'],
            'logs': ['server.log', 'output.log']
        }
        
        self.is_running = False
        self.backup_thread = None

    def start_automatic_backups(self):
        """
        Démarre les sauvegardes automatiques programmées
        """
        if not self.config['enabled']:
            logger.info("Backup: Sauvegardes automatiques désactivées")
            return
        
        self.is_running = True
        
        # Programmer les sauvegardes
        if self.config['daily_backups']:
            schedule.every().day.at(self.config['schedule_time']).do(
                self._scheduled_backup, 'daily'
            )
        
        if self.config['weekly_backups']:
            schedule.every().sunday.at(self.config['schedule_time']).do(
                self._scheduled_backup, 'weekly'
            )
        
        if self.config['monthly_backups']:
            schedule.every().month.do(
                self._scheduled_backup, 'monthly'
            )
        
        # Thread pour exécuter les tâches programmées
        self.backup_thread = threading.Thread(target=self._scheduler_worker, daemon=True)
        self.backup_thread.start()
        
        logger.info("Backup: Sauvegardes automatiques démarrées")

    def stop_automatic_backups(self):
        """
        Arrête les sauvegardes automatiques
        """
        self.is_running = False
        schedule.clear()
        
        if self.backup_thread and self.backup_thread.is_alive():
            self.backup_thread.join(timeout=5)
        
        logger.info("Backup: Sauvegardes automatiques arrêtées")

    def create_backup(self, backup_type: str = 'manual', description: str = '') -> Optional[str]:
        """
        Crée une sauvegarde complète
        
        Returns:
            str: Chemin vers le fichier de sauvegarde créé
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = f"{backup_type}_{timestamp}"
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            logger.info(f"Backup: Création de la sauvegarde {backup_name}")
            
            # Métadonnées de la sauvegarde
            metadata = {
                'created_at': datetime.now().isoformat(),
                'type': backup_type,
                'description': description,
                'version': '4.0.0',
                'files': {}
            }
            
            # Sauvegarder la base de données
            if self._backup_database(backup_path):
                metadata['files']['database'] = 'surveillance.db'
            
            # Sauvegarder les fichiers de configuration
            config_files = self._backup_config_files(backup_path)
            if config_files:
                metadata['files']['config'] = config_files
            
            # Sauvegarder les caches
            cache_files = self._backup_cache_files(backup_path)
            if cache_files:
                metadata['files']['cache'] = cache_files
            
            # Sauvegarder les logs récents
            log_files = self._backup_log_files(backup_path)
            if log_files:
                metadata['files']['logs'] = log_files
            
            # Sauvegarder les métadonnées
            with open(backup_path / 'metadata.json', 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            # Compression si activée
            final_path = backup_path
            if self.config['compression']:
                final_path = self._compress_backup(backup_path)
                if final_path != backup_path:
                    shutil.rmtree(backup_path)  # Supprimer le dossier non compressé
            
            # Nettoyage des anciennes sauvegardes
            self._cleanup_old_backups(backup_type)
            
            logger.info(f"Backup: Sauvegarde créée avec succès: {final_path.name}")
            return str(final_path)
            
        except Exception as e:
            logger.error(f"Backup: Erreur lors de la création de la sauvegarde: {e}")
            return None

    def list_backups(self) -> List[Dict[str, any]]:
        """
        Liste toutes les sauvegardes disponibles avec leurs métadonnées
        """
        backups = []
        
        for item in self.backup_dir.iterdir():
            if item.is_file() and item.name.endswith('.tar.gz'):
                # Sauvegarde compressée
                backup_info = self._get_compressed_backup_info(item)
            elif item.is_dir():
                # Sauvegarde non compressée
                backup_info = self._get_backup_info(item)
            else:
                continue
            
            if backup_info:
                backups.append(backup_info)
        
        # Trier par date de création (plus récent en premier)
        backups.sort(key=lambda x: x['created_at'], reverse=True)
        return backups

    def restore_backup(self, backup_name: str, restore_options: Dict[str, bool] = None) -> bool:
        """
        Restaure une sauvegarde
        
        Args:
            backup_name: Nom de la sauvegarde à restaurer
            restore_options: Options de restauration (database, config, cache, logs)
        """
        if restore_options is None:
            restore_options = {
                'database': True,
                'config': True,
                'cache': False,
                'logs': False
            }
        
        try:
            # Trouver la sauvegarde
            backup_path = self._find_backup(backup_name)
            if not backup_path:
                logger.error(f"Backup: Sauvegarde {backup_name} introuvable")
                return False
            
            # Créer une sauvegarde de sécurité avant la restauration
            security_backup = self.create_backup('pre_restore', f'Avant restauration de {backup_name}')
            
            logger.info(f"Backup: Début de la restauration de {backup_name}")
            
            # Décompresser si nécessaire
            work_dir = backup_path
            if backup_path.suffix == '.gz':
                work_dir = self._decompress_backup(backup_path)
            
            # Charger les métadonnées
            metadata_file = work_dir / 'metadata.json'
            if not metadata_file.exists():
                logger.error("Backup: Métadonnées de sauvegarde introuvables")
                return False
            
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Restaurer selon les options
            success = True
            
            if restore_options.get('database') and 'database' in metadata['files']:
                success &= self._restore_database(work_dir)
            
            if restore_options.get('config') and 'config' in metadata['files']:
                success &= self._restore_config_files(work_dir, metadata['files']['config'])
            
            if restore_options.get('cache') and 'cache' in metadata['files']:
                success &= self._restore_cache_files(work_dir, metadata['files']['cache'])
            
            if restore_options.get('logs') and 'logs' in metadata['files']:
                success &= self._restore_log_files(work_dir, metadata['files']['logs'])
            
            # Nettoyer le dossier temporaire si décompressé
            if work_dir != backup_path and work_dir.exists():
                shutil.rmtree(work_dir)
            
            if success:
                logger.info(f"Backup: Restauration de {backup_name} réussie")
            else:
                logger.error(f"Backup: Erreurs lors de la restauration de {backup_name}")
            
            return success
            
        except Exception as e:
            logger.error(f"Backup: Erreur lors de la restauration: {e}")
            return False

    def delete_backup(self, backup_name: str) -> bool:
        """
        Supprime une sauvegarde
        """
        try:
            backup_path = self._find_backup(backup_name)
            if backup_path and backup_path.exists():
                if backup_path.is_file():
                    backup_path.unlink()
                else:
                    shutil.rmtree(backup_path)
                logger.info(f"Backup: Sauvegarde {backup_name} supprimée")
                return True
            return False
        except Exception as e:
            logger.error(f"Backup: Erreur suppression sauvegarde {backup_name}: {e}")
            return False

    def get_backup_stats(self) -> Dict[str, any]:
        """
        Retourne les statistiques des sauvegardes
        """
        backups = self.list_backups()
        
        total_size = 0
        types_count = {'daily': 0, 'weekly': 0, 'monthly': 0, 'manual': 0}
        
        for backup in backups:
            total_size += backup.get('size', 0)
            backup_type = backup.get('type', 'manual')
            types_count[backup_type] = types_count.get(backup_type, 0) + 1
        
        return {
            'total_backups': len(backups),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'by_type': types_count,
            'oldest_backup': backups[-1]['created_at'] if backups else None,
            'newest_backup': backups[0]['created_at'] if backups else None,
            'auto_backup_enabled': self.config['enabled']
        }

    # Méthodes privées pour les opérations de sauvegarde/restauration

    def _scheduled_backup(self, backup_type: str):
        """
        Crée une sauvegarde programmée
        """
        description = f"Sauvegarde automatique {backup_type}"
        self.create_backup(backup_type, description)

    def _scheduler_worker(self):
        """
        Worker thread pour les tâches programmées
        """
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Vérifier toutes les minutes

    def _backup_database(self, backup_path: Path) -> bool:
        """
        Sauvegarde la base de données SQLite
        """
        try:
            db_file = Path(self.backup_targets['database'])
            if db_file.exists():
                # Utiliser la sauvegarde SQLite pour consistance
                backup_db_path = backup_path / 'surveillance.db'
                
                source_conn = sqlite3.connect(str(db_file))
                backup_conn = sqlite3.connect(str(backup_db_path))
                
                source_conn.backup(backup_conn)
                
                source_conn.close()
                backup_conn.close()
                
                return True
        except Exception as e:
            logger.error(f"Backup: Erreur sauvegarde database: {e}")
        return False

    def _backup_config_files(self, backup_path: Path) -> List[str]:
        """
        Sauvegarde les fichiers de configuration
        """
        saved_files = []
        config_dir = backup_path / 'config'
        config_dir.mkdir(exist_ok=True)
        
        config_file = Path(self.backup_targets['config'])
        if config_file.exists():
            try:
                shutil.copy2(config_file, config_dir)
                saved_files.append(config_file.name)
            except Exception as e:
                logger.error(f"Backup: Erreur sauvegarde config {config_file}: {e}")
        
        return saved_files

    def _backup_cache_files(self, backup_path: Path) -> List[str]:
        """
        Sauvegarde les fichiers de cache
        """
        saved_files = []
        cache_dir = backup_path / 'cache'
        cache_dir.mkdir(exist_ok=True)
        
        for cache_file in self.backup_targets['cache']:
            cache_path = Path(cache_file)
            if cache_path.exists():
                try:
                    shutil.copy2(cache_path, cache_dir)
                    saved_files.append(cache_file)
                except Exception as e:
                    logger.error(f"Backup: Erreur sauvegarde cache {cache_file}: {e}")
        
        return saved_files

    def _backup_log_files(self, backup_path: Path) -> List[str]:
        """
        Sauvegarde les fichiers de logs récents
        """
        saved_files = []
        logs_dir = backup_path / 'logs'
        logs_dir.mkdir(exist_ok=True)
        
        for log_file in self.backup_targets['logs']:
            log_path = Path(log_file)
            if log_path.exists():
                try:
                    # Copier seulement les dernières lignes pour économiser l'espace
                    self._copy_recent_logs(log_path, logs_dir / log_file)
                    saved_files.append(log_file)
                except Exception as e:
                    logger.error(f"Backup: Erreur sauvegarde log {log_file}: {e}")
        
        return saved_files

    def _copy_recent_logs(self, source: Path, dest: Path, max_lines: int = 1000):
        """
        Copie seulement les dernières lignes d'un fichier de log
        """
        try:
            with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            # Garder seulement les dernières lignes
            recent_lines = lines[-max_lines:] if len(lines) > max_lines else lines
            
            with open(dest, 'w', encoding='utf-8') as f:
                f.writelines(recent_lines)
        except Exception as e:
            logger.error(f"Backup: Erreur copie log récent: {e}")

    def _compress_backup(self, backup_path: Path) -> Path:
        """
        Compresse un dossier de sauvegarde en tar.gz
        """
        import tarfile
        
        try:
            compressed_path = backup_path.with_suffix('.tar.gz')
            
            with tarfile.open(compressed_path, 'w:gz') as tar:
                tar.add(backup_path, arcname=backup_path.name)
            
            return compressed_path
        except Exception as e:
            logger.error(f"Backup: Erreur compression: {e}")
            return backup_path

    def _decompress_backup(self, compressed_path: Path) -> Path:
        """
        Décompresse une sauvegarde tar.gz
        """
        import tarfile
        import tempfile
        
        try:
            temp_dir = Path(tempfile.mkdtemp())
            
            with tarfile.open(compressed_path, 'r:gz') as tar:
                tar.extractall(temp_dir)
            
            # Retourner le chemin du dossier extrait
            extracted_dirs = list(temp_dir.iterdir())
            if extracted_dirs:
                return extracted_dirs[0]
            
            return temp_dir
        except Exception as e:
            logger.error(f"Backup: Erreur décompression: {e}")
            return compressed_path

    def _cleanup_old_backups(self, backup_type: str):
        """
        Nettoie les anciennes sauvegardes selon la politique de rétention
        """
        try:
            keep_count = self.config.get(f'keep_{backup_type}', 7)
            
            # Lister les sauvegardes de ce type
            type_backups = []
            for item in self.backup_dir.iterdir():
                if item.name.startswith(backup_type + '_'):
                    if item.is_file() and item.suffix == '.gz':
                        type_backups.append(item)
                    elif item.is_dir():
                        type_backups.append(item)
            
            # Trier par date de modification (plus ancien en premier)
            type_backups.sort(key=lambda x: x.stat().st_mtime)
            
            # Supprimer les plus anciennes si dépassement
            while len(type_backups) > keep_count:
                old_backup = type_backups.pop(0)
                try:
                    if old_backup.is_file():
                        old_backup.unlink()
                    else:
                        shutil.rmtree(old_backup)
                    logger.info(f"Backup: Supprimé ancienne sauvegarde {old_backup.name}")
                except Exception as e:
                    logger.error(f"Backup: Erreur suppression {old_backup.name}: {e}")
                    
        except Exception as e:
            logger.error(f"Backup: Erreur nettoyage sauvegardes {backup_type}: {e}")

    def _find_backup(self, backup_name: str) -> Optional[Path]:
        """
        Trouve une sauvegarde par son nom
        """
        # Chercher d'abord le dossier
        folder_path = self.backup_dir / backup_name
        if folder_path.is_dir():
            return folder_path
        
        # Puis le fichier compressé
        compressed_path = self.backup_dir / f"{backup_name}.tar.gz"
        if compressed_path.is_file():
            return compressed_path
        
        return None

    def _get_backup_info(self, backup_path: Path) -> Optional[Dict[str, any]]:
        """
        Récupère les informations d'une sauvegarde non compressée
        """
        try:
            metadata_file = backup_path / 'metadata.json'
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                
                # Calculer la taille
                size = sum(f.stat().st_size for f in backup_path.rglob('*') if f.is_file())
                
                return {
                    'name': backup_path.name,
                    'created_at': metadata['created_at'],
                    'type': metadata['type'],
                    'description': metadata.get('description', ''),
                    'size': size,
                    'compressed': False,
                    'files': metadata.get('files', {})
                }
        except Exception as e:
            logger.error(f"Backup: Erreur lecture info sauvegarde {backup_path}: {e}")
        
        return None

    def _get_compressed_backup_info(self, backup_path: Path) -> Optional[Dict[str, any]]:
        """
        Récupère les informations d'une sauvegarde compressée
        """
        import tarfile
        
        try:
            size = backup_path.stat().st_size
            
            # Extraire les métadonnées sans décompresser complètement
            with tarfile.open(backup_path, 'r:gz') as tar:
                # Chercher le fichier metadata.json
                for member in tar.getmembers():
                    if member.name.endswith('metadata.json'):
                        f = tar.extractfile(member)
                        if f:
                            metadata = json.load(f)
                            
                            return {
                                'name': backup_path.stem.replace('.tar', ''),
                                'created_at': metadata['created_at'],
                                'type': metadata['type'],
                                'description': metadata.get('description', ''),
                                'size': size,
                                'compressed': True,
                                'files': metadata.get('files', {})
                            }
                        break
        except Exception as e:
            logger.error(f"Backup: Erreur lecture info sauvegarde compressée {backup_path}: {e}")
        
        return None

    def _restore_database(self, work_dir: Path) -> bool:
        """
        Restaure la base de données
        """
        try:
            backup_db = work_dir / 'surveillance.db'
            if backup_db.exists():
                # Créer une copie de sécurité de la DB actuelle
                current_db = Path('surveillance.db')
                if current_db.exists():
                    shutil.copy2(current_db, current_db.with_suffix('.db.backup'))
                
                # Restaurer la DB
                shutil.copy2(backup_db, 'surveillance.db')
                logger.info("Backup: Base de données restaurée")
                return True
        except Exception as e:
            logger.error(f"Backup: Erreur restauration database: {e}")
        return False

    def _restore_config_files(self, work_dir: Path, config_files: List[str]) -> bool:
        """
        Restaure les fichiers de configuration
        """
        try:
            config_dir = work_dir / 'config'
            if config_dir.exists():
                for config_file in config_files:
                    source = config_dir / config_file
                    if source.exists():
                        shutil.copy2(source, config_file)
                        logger.info(f"Backup: Configuration {config_file} restaurée")
                return True
        except Exception as e:
            logger.error(f"Backup: Erreur restauration config: {e}")
        return False

    def _restore_cache_files(self, work_dir: Path, cache_files: List[str]) -> bool:
        """
        Restaure les fichiers de cache
        """
        try:
            cache_dir = work_dir / 'cache'
            if cache_dir.exists():
                for cache_file in cache_files:
                    source = cache_dir / cache_file
                    if source.exists():
                        shutil.copy2(source, cache_file)
                        logger.info(f"Backup: Cache {cache_file} restauré")
                return True
        except Exception as e:
            logger.error(f"Backup: Erreur restauration cache: {e}")
        return False

    def _restore_log_files(self, work_dir: Path, log_files: List[str]) -> bool:
        """
        Restaure les fichiers de logs
        """
        try:
            logs_dir = work_dir / 'logs'
            if logs_dir.exists():
                for log_file in log_files:
                    source = logs_dir / log_file
                    if source.exists():
                        # Ajouter un suffixe pour ne pas écraser les logs actuels
                        dest_name = f"{log_file}.restored"
                        shutil.copy2(source, dest_name)
                        logger.info(f"Backup: Log {log_file} restauré comme {dest_name}")
                return True
        except Exception as e:
            logger.error(f"Backup: Erreur restauration logs: {e}")
        return False


# Instance globale
backup_manager = AutoBackupManager()


def start_backup_system():
    """
    Démarre le système de sauvegarde automatique
    """
    backup_manager.start_automatic_backups()


def stop_backup_system():
    """
    Arrête le système de sauvegarde automatique
    """
    backup_manager.stop_automatic_backups()


def create_manual_backup(description: str = '') -> Optional[str]:
    """
    Crée une sauvegarde manuelle
    """
    return backup_manager.create_backup('manual', description)