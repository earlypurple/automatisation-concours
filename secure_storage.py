"""
Module de chiffrement pour les données sensibles stockées côté client
"""
import base64
import json
import hashlib
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from logger import logger


class ClientDataEncryption:
    """
    Classe pour chiffrer/déchiffrer les données sensibles côté client
    """
    
    def __init__(self, user_password=None):
        """
        Initialise le chiffreur avec un mot de passe utilisateur ou une clé générée
        """
        self.salt = b'automatisation_concours_salt_2024'  # Salt fixe pour la cohérence
        
        if user_password:
            self.key = self._derive_key_from_password(user_password)
        else:
            # Utiliser une clé basée sur des identifiants système
            self.key = self._generate_device_key()
        
        self.cipher = Fernet(self.key)

    def _derive_key_from_password(self, password):
        """
        Dérive une clé de chiffrement à partir d'un mot de passe utilisateur
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key

    def _generate_device_key(self):
        """
        Génère une clé basée sur des caractéristiques de l'appareil
        (pour une sécurité basique sans mot de passe utilisateur)
        """
        # Utiliser des informations système comme base
        import platform
        device_info = f"{platform.node()}_{platform.system()}_{platform.release()}"
        
        # Créer une empreinte unique
        device_hash = hashlib.sha256((device_info + str(self.salt, 'utf-8')).encode()).digest()
        
        # Dériver une clé Fernet valide
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=50000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(device_hash))
        return key

    def encrypt_data(self, data):
        """
        Chiffre des données (dict, list, string)
        
        Returns:
            str: Données chiffrées encodées en base64
        """
        try:
            # Convertir en JSON si ce n'est pas déjà une string
            if isinstance(data, (dict, list)):
                json_data = json.dumps(data, ensure_ascii=False)
            else:
                json_data = str(data)
            
            # Chiffrer
            encrypted = self.cipher.encrypt(json_data.encode('utf-8'))
            
            # Encoder en base64 pour le stockage
            return base64.urlsafe_b64encode(encrypted).decode('ascii')
            
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            return None

    def decrypt_data(self, encrypted_data):
        """
        Déchiffre des données
        
        Args:
            encrypted_data (str): Données chiffrées en base64
            
        Returns:
            object: Données déchiffrées (tentative de parsing JSON)
        """
        try:
            # Décoder le base64
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode('ascii'))
            
            # Déchiffrer
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            json_data = decrypted_bytes.decode('utf-8')
            
            # Essayer de parser en JSON
            try:
                return json.loads(json_data)
            except json.JSONDecodeError:
                # Retourner comme string si ce n'est pas du JSON
                return json_data
                
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return None

    def encrypt_profile_data(self, profile_data):
        """
        Chiffre spécifiquement les données de profil sensibles
        """
        sensitive_fields = ['email', 'phone', 'address', 'preferences', 'api_keys']
        
        if not isinstance(profile_data, dict):
            return self.encrypt_data(profile_data)
        
        encrypted_profile = profile_data.copy()
        
        for field in sensitive_fields:
            if field in encrypted_profile and encrypted_profile[field]:
                encrypted_profile[field] = self.encrypt_data(encrypted_profile[field])
                encrypted_profile[f'{field}_encrypted'] = True
        
        return encrypted_profile

    def decrypt_profile_data(self, encrypted_profile):
        """
        Déchiffre les données de profil
        """
        if not isinstance(encrypted_profile, dict):
            return self.decrypt_data(encrypted_profile)
        
        decrypted_profile = encrypted_profile.copy()
        sensitive_fields = ['email', 'phone', 'address', 'preferences', 'api_keys']
        
        for field in sensitive_fields:
            if decrypted_profile.get(f'{field}_encrypted'):
                decrypted_data = self.decrypt_data(decrypted_profile[field])
                if decrypted_data is not None:
                    decrypted_profile[field] = decrypted_data
                # Nettoyer le flag de chiffrement
                del decrypted_profile[f'{field}_encrypted']
        
        return decrypted_profile


# JavaScript compatible functions (pour génération de code JS)
def generate_client_encryption_js():
    """
    Génère le code JavaScript pour le chiffrement côté client
    """
    return """
// Chiffrement côté client (version simplifiée)
class ClientCrypto {
    constructor(userKey = null) {
        // Utiliser une clé simple basée sur le navigateur si pas de clé utilisateur
        this.key = userKey || this.generateBrowserKey();
    }
    
    generateBrowserKey() {
        // Créer une clé basée sur des caractéristiques du navigateur
        const browserInfo = navigator.userAgent + navigator.language + screen.width + screen.height;
        return btoa(browserInfo).substring(0, 32);
    }
    
    encrypt(data) {
        try {
            const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
            // Chiffrement simple XOR pour les données non-critiques
            const encrypted = btoa(jsonData.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length))
            ).join(''));
            return encrypted;
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    }
    
    decrypt(encryptedData) {
        try {
            const decodedData = atob(encryptedData);
            const decrypted = decodedData.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length))
            ).join('');
            
            try {
                return JSON.parse(decrypted);
            } catch {
                return decrypted;
            }
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    }
    
    // Stockage sécurisé dans localStorage
    setSecureItem(key, value) {
        const encrypted = this.encrypt(value);
        if (encrypted) {
            localStorage.setItem('enc_' + key, encrypted);
            return true;
        }
        return false;
    }
    
    getSecureItem(key) {
        const encrypted = localStorage.getItem('enc_' + key);
        if (encrypted) {
            return this.decrypt(encrypted);
        }
        return null;
    }
    
    removeSecureItem(key) {
        localStorage.removeItem('enc_' + key);
    }
}

// Instance globale
window.clientCrypto = new ClientCrypto();
"""


# Instance globale pour Python
try:
    default_encryptor = ClientDataEncryption()
except Exception as e:
    logger.warning(f"Could not initialize default encryptor: {e}")
    default_encryptor = None


def encrypt_for_storage(data, password=None):
    """
    Fonction utilitaire pour chiffrer des données pour le stockage
    """
    try:
        if password:
            encryptor = ClientDataEncryption(password)
        else:
            encryptor = default_encryptor
        
        if encryptor:
            return encryptor.encrypt_data(data)
        else:
            logger.warning("No encryptor available, storing data unencrypted")
            return json.dumps(data) if isinstance(data, (dict, list)) else str(data)
    except Exception as e:
        logger.error(f"Storage encryption failed: {e}")
        return json.dumps(data) if isinstance(data, (dict, list)) else str(data)


def decrypt_from_storage(encrypted_data, password=None):
    """
    Fonction utilitaire pour déchiffrer des données du stockage
    """
    try:
        if password:
            encryptor = ClientDataEncryption(password)
        else:
            encryptor = default_encryptor
        
        if encryptor:
            return encryptor.decrypt_data(encrypted_data)
        else:
            # Essayer de parser comme JSON non-chiffré
            try:
                return json.loads(encrypted_data)
            except:
                return encrypted_data
    except Exception as e:
        logger.error(f"Storage decryption failed: {e}")
        try:
            return json.loads(encrypted_data)
        except:
            return encrypted_data