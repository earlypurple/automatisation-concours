// smartCache.js
// Système de cache intelligent multi-niveaux avec prédiction et compression

class SmartCache {
    constructor() {
        this.levels = {
            memory: new Map(),
            sessionStorage: typeof sessionStorage !== 'undefined' ? sessionStorage : null,
            indexedDB: null
        };
        
        this.config = {
            maxMemoryItems: 1000,
            maxMemorySize: 50 * 1024 * 1024, // 50MB
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            compressionThreshold: 1024, // Compresser si > 1KB
            predictiveLoading: true,
            autoCleanup: true
        };
        
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0,
            compressionSaved: 0,
            predictiveHits: 0
        };
        
        this.accessPatterns = new Map();
        this.predictionModel = new PredictionModel();
        this.compressionEngine = new CompressionEngine();
        
        this.init();
        this.cleanupInterval = null;
        this.predictiveInterval = null;
    }

    async init() {
        // Initialiser IndexedDB pour le stockage persistant
        await this.initIndexedDB();
        
        // Démarrer le nettoyage automatique
        if (this.config.autoCleanup) {
            this.startAutoCleanup();
        }
        
        // Initialiser la prédiction si activée
        if (this.config.predictiveLoading) {
            this.initPredictiveLoading();
        }
        
        console.log('🧠 Smart Cache initialized with multi-level storage');
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.predictiveInterval) {
            clearInterval(this.predictiveInterval);
        }
    }

    async initIndexedDB() {
        if (typeof indexedDB === 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SmartCache', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.levels.indexedDB = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('expires', 'expires', { unique: false });
                    store.createIndex('accessed', 'lastAccessed', { unique: false });
                }
            };
        });
    }

    async get(key, options = {}) {
        const startTime = performance.now();
        
        try {
            // 1. Vérifier cache mémoire (le plus rapide)
            const memoryResult = this.getFromMemory(key);
            if (memoryResult !== null) {
                this.recordHit('memory', performance.now() - startTime);
                this.updateAccessPattern(key);
                return memoryResult;
            }

            // 2. Vérifier sessionStorage
            const sessionResult = await this.getFromSessionStorage(key);
            if (sessionResult !== null) {
                // Remonter vers la mémoire pour accès futur plus rapide
                this.setInMemory(key, sessionResult.data, sessionResult.expires);
                this.recordHit('session', performance.now() - startTime);
                this.updateAccessPattern(key);
                return sessionResult.data;
            }

            // 3. Vérifier IndexedDB (le plus lent mais persistant)
            const indexedResult = await this.getFromIndexedDB(key);
            if (indexedResult !== null) {
                // Remonter vers les niveaux supérieurs
                this.setInMemory(key, indexedResult.data, indexedResult.expires);
                this.setInSessionStorage(key, indexedResult.data, indexedResult.expires);
                this.recordHit('indexedDB', performance.now() - startTime);
                this.updateAccessPattern(key);
                return indexedResult.data;
            }

            // Cache miss
            this.recordMiss(performance.now() - startTime);
            
            // Tentative de prédiction si activée
            if (this.config.predictiveLoading) {
                this.triggerPredictiveLoading(key);
            }
            
            return null;
            
        } catch (error) {
            console.error('Smart cache get error:', error);
            return null;
        }
    }

    async set(key, data, ttl = this.config.defaultTTL, options = {}) {
        const startTime = performance.now();
        
        try {
            const expires = Date.now() + ttl;
            const priority = options.priority || 'normal';
            const compressed = await this.compressIfNeeded(data);
            
            // Stocker dans tous les niveaux appropriés
            this.setInMemory(key, data, expires, priority);
            
            if (options.persistent !== false) {
                await this.setInSessionStorage(key, compressed, expires);
                await this.setInIndexedDB(key, compressed, expires, priority);
            }
            
            this.stats.sets++;
            this.updateAccessPattern(key);
            
            console.log(`📦 Cached ${key} (${this.getDataSize(data)} bytes, TTL: ${ttl}ms)`);
            
        } catch (error) {
            console.error('Smart cache set error:', error);
        }
    }

    getFromMemory(key) {
        const item = this.levels.memory.get(key);
        if (!item) return null;
        
        if (item.expires && Date.now() > item.expires) {
            this.levels.memory.delete(key);
            return null;
        }
        
        item.lastAccessed = Date.now();
        return item.data;
    }

    setInMemory(key, data, expires, priority = 'normal') {
        // Vérifier les limites de mémoire
        if (this.levels.memory.size >= this.config.maxMemoryItems) {
            this.evictFromMemory();
        }
        
        this.levels.memory.set(key, {
            data: data,
            expires: expires,
            lastAccessed: Date.now(),
            priority: priority,
            size: this.getDataSize(data)
        });
    }

    async getFromSessionStorage(key) {
        if (!this.levels.sessionStorage) return null;
        
        try {
            const stored = this.levels.sessionStorage.getItem(`smartcache_${key}`);
            if (!stored) return null;
            
            const item = JSON.parse(stored);
            if (item.expires && Date.now() > item.expires) {
                this.levels.sessionStorage.removeItem(`smartcache_${key}`);
                return null;
            }
            
            // Décompresser si nécessaire
            const data = await this.decompressIfNeeded(item.data);
            return { data, expires: item.expires };
            
        } catch (error) {
            console.warn('SessionStorage get error:', error);
            return null;
        }
    }

    async setInSessionStorage(key, data, expires) {
        if (!this.levels.sessionStorage) return;
        
        try {
            const item = {
                data: data,
                expires: expires,
                stored: Date.now()
            };
            
            this.levels.sessionStorage.setItem(`smartcache_${key}`, JSON.stringify(item));
        } catch (error) {
            // Gérer les erreurs de quota dépassé
            if (error.name === 'QuotaExceededError') {
                this.cleanupSessionStorage();
                // Retry une fois après nettoyage
                try {
                    this.levels.sessionStorage.setItem(`smartcache_${key}`, JSON.stringify(item));
                } catch (retryError) {
                    console.warn('SessionStorage quota exceeded even after cleanup');
                }
            }
        }
    }

    async getFromIndexedDB(key) {
        if (!this.levels.indexedDB) return null;
        
        return new Promise((resolve) => {
            const transaction = this.levels.indexedDB.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            
            request.onsuccess = async () => {
                if (!request.result) {
                    resolve(null);
                    return;
                }
                
                const item = request.result;
                if (item.expires && Date.now() > item.expires) {
                    this.deleteFromIndexedDB(key);
                    resolve(null);
                    return;
                }
                
                const data = await this.decompressIfNeeded(item.data);
                resolve({ data, expires: item.expires });
            };
            
            request.onerror = () => resolve(null);
        });
    }

    async setInIndexedDB(key, data, expires, priority = 'normal') {
        if (!this.levels.indexedDB) return;
        
        return new Promise((resolve) => {
            const transaction = this.levels.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            
            const item = {
                key: key,
                data: data,
                expires: expires,
                lastAccessed: Date.now(),
                priority: priority,
                size: this.getDataSize(data)
            };
            
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }

    async compressIfNeeded(data) {
        const size = this.getDataSize(data);
        if (size > this.config.compressionThreshold) {
            const compressed = await this.compressionEngine.compress(data);
            if (compressed.size < size * 0.8) { // Au moins 20% de réduction
                this.stats.compressionSaved += size - compressed.size;
                return compressed;
            }
        }
        return data;
    }

    async decompressIfNeeded(data) {
        if (data && data.__compressed) {
            return await this.compressionEngine.decompress(data);
        }
        return data;
    }

    evictFromMemory() {
        // Stratégie d'éviction LRU avec priorité
        const items = Array.from(this.levels.memory.entries());
        
        // Trier par priorité puis par dernier accès
        items.sort((a, b) => {
            const priorityOrder = { low: 0, normal: 1, high: 2 };
            const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a[1].lastAccessed - b[1].lastAccessed;
        });
        
        // Supprimer 10% des éléments les moins prioritaires/récents
        const toEvict = Math.ceil(items.length * 0.1);
        for (let i = 0; i < toEvict; i++) {
            this.levels.memory.delete(items[i][0]);
            this.stats.evictions++;
        }
    }

    cleanupSessionStorage() {
        if (!this.levels.sessionStorage) return;
        
        const keys = [];
        for (let i = 0; i < this.levels.sessionStorage.length; i++) {
            const key = this.levels.sessionStorage.key(i);
            if (key && key.startsWith('smartcache_')) {
                keys.push(key);
            }
        }
        
        // Supprimer les éléments expirés et les plus anciens
        keys.forEach(key => {
            try {
                const item = JSON.parse(this.levels.sessionStorage.getItem(key));
                if (item.expires && Date.now() > item.expires) {
                    this.levels.sessionStorage.removeItem(key);
                }
            } catch (error) {
                this.levels.sessionStorage.removeItem(key);
            }
        });
    }

    updateAccessPattern(key) {
        const pattern = this.accessPatterns.get(key) || {
            count: 0,
            lastAccess: 0,
            timesBetweenAccess: []
        };
        
        const now = Date.now();
        if (pattern.lastAccess > 0) {
            const timeBetween = now - pattern.lastAccess;
            pattern.timesBetweenAccess.push(timeBetween);
            if (pattern.timesBetweenAccess.length > 10) {
                pattern.timesBetweenAccess.shift();
            }
        }
        
        pattern.count++;
        pattern.lastAccess = now;
        this.accessPatterns.set(key, pattern);
        
        // Alimenter le modèle de prédiction
        this.predictionModel.updatePattern(key, pattern);
    }

    triggerPredictiveLoading(key) {
        // Prédire les prochaines clés probablement demandées
        const predictions = this.predictionModel.predict(key);
        
        predictions.forEach(async (predictedKey) => {
            if (!this.levels.memory.has(predictedKey)) {
                // Charger de manière asynchrone en arrière-plan
                const data = await this.getFromSessionStorage(predictedKey) ||
                           await this.getFromIndexedDB(predictedKey);
                
                if (data) {
                    this.setInMemory(predictedKey, data.data, data.expires, 'low');
                    this.stats.predictiveHits++;
                }
            }
        });
    }

    initPredictiveLoading() {
        // Analyser les patterns d'accès périodiquement
        this.predictiveInterval = setInterval(() => {
            this.predictionModel.analyzePatterns(this.accessPatterns);
        }, 30000); // Toutes les 30 secondes
    }

    startAutoCleanup() {
        // Nettoyage automatique périodique
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // Toutes les 5 minutes
    }

    async cleanup() {
        console.log('🧹 Starting smart cache cleanup...');
        
        // Nettoyer la mémoire
        this.cleanupExpiredMemory();
        
        // Nettoyer sessionStorage
        this.cleanupSessionStorage();
        
        // Nettoyer IndexedDB
        await this.cleanupIndexedDB();
        
        console.log('✨ Smart cache cleanup completed');
    }

    cleanupExpiredMemory() {
        const now = Date.now();
        for (const [key, item] of this.levels.memory.entries()) {
            if (item.expires && now > item.expires) {
                this.levels.memory.delete(key);
            }
        }
    }

    async cleanupIndexedDB() {
        if (!this.levels.indexedDB) return;
        
        return new Promise((resolve) => {
            const transaction = this.levels.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('expires');
            
            const now = Date.now();
            const range = IDBKeyRange.upperBound(now);
            
            index.openCursor(range).onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    }

    recordHit(level, responseTime) {
        this.stats.hits++;
        console.log(`💾 Cache hit (${level}) in ${responseTime.toFixed(2)}ms`);
    }

    recordMiss(responseTime) {
        this.stats.misses++;
        console.log(`❌ Cache miss in ${responseTime.toFixed(2)}ms`);
    }

    getDataSize(data) {
        if (typeof data === 'string') {
            return new Blob([data]).size;
        }
        return new Blob([JSON.stringify(data)]).size;
    }

    // API publique
    async clear(pattern = null) {
        if (pattern) {
            // Effacer par pattern
            const regex = new RegExp(pattern);
            
            // Mémoire
            for (const key of this.levels.memory.keys()) {
                if (regex.test(key)) {
                    this.levels.memory.delete(key);
                }
            }
            
            // SessionStorage
            if (this.levels.sessionStorage) {
                for (let i = this.levels.sessionStorage.length - 1; i >= 0; i--) {
                    const key = this.levels.sessionStorage.key(i);
                    if (key && key.startsWith('smartcache_') && regex.test(key.substring(11))) {
                        this.levels.sessionStorage.removeItem(key);
                    }
                }
            }
            
            // IndexedDB
            if (this.levels.indexedDB) {
                await this.clearIndexedDBByPattern(regex);
            }
        } else {
            // Effacer tout
            this.levels.memory.clear();
            if (this.levels.sessionStorage) {
                this.levels.sessionStorage.clear();
            }
            if (this.levels.indexedDB) {
                await this.clearAllIndexedDB();
            }
        }
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
            
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            memoryItems: this.levels.memory.size,
            compressionSavedMB: (this.stats.compressionSaved / 1024 / 1024).toFixed(2)
        };
    }

    // Méthodes utilitaires pour l'exportation
    async export() {
        const memoryData = Object.fromEntries(this.levels.memory);
        return {
            memory: memoryData,
            stats: this.stats,
            accessPatterns: Object.fromEntries(this.accessPatterns),
            timestamp: Date.now()
        };
    }
}

// Modèle de prédiction simple
class PredictionModel {
    constructor() {
        this.patterns = new Map();
        this.correlations = new Map();
    }

    updatePattern(key, pattern) {
        this.patterns.set(key, pattern);
    }

    predict(key) {
        // Prédiction basée sur les corrélations historiques
        const correlatedKeys = this.correlations.get(key) || [];
        return correlatedKeys.slice(0, 3); // Top 3 prédictions
    }

    analyzePatterns(accessPatterns) {
        // Analyser les corrélations entre les accès
        // Implémentation simplifiée
        console.log('🔮 Analyzing access patterns for prediction');
    }
}

// Moteur de compression
class CompressionEngine {
    async compress(data) {
        try {
            if (typeof CompressionStream !== 'undefined') {
                // Utiliser l'API de compression native si disponible
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(new TextEncoder().encode(JSON.stringify(data)));
                writer.close();
                
                const chunks = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                return {
                    __compressed: true,
                    data: chunks,
                    originalSize: this.getSize(data),
                    algorithm: 'gzip'
                };
            } else {
                // Fallback: compression simple par JSON
                return {
                    __compressed: false,
                    data: data
                };
            }
        } catch (error) {
            console.warn('Compression failed:', error);
            return data;
        }
    }

    async decompress(compressedData) {
        if (!compressedData.__compressed) {
            return compressedData.data;
        }
        
        try {
            if (typeof DecompressionStream !== 'undefined') {
                const stream = new DecompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                for (const chunk of compressedData.data) {
                    writer.write(chunk);
                }
                writer.close();
                
                const chunks = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const decompressed = new TextDecoder().decode(
                    new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
                );
                
                return JSON.parse(decompressed);
            } else {
                return compressedData.data;
            }
        } catch (error) {
            console.error('Decompression failed:', error);
            return compressedData.data;
        }
    }

    getSize(data) {
        return new Blob([JSON.stringify(data)]).size;
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartCache;
}

// Instance globale
if (typeof window !== 'undefined') {
    window.SmartCache = SmartCache;
}