// js/config.js
// Gestionnaire de configuration centralisé

class ConfigManager {
    constructor() {
        this.config = {
            // Configuration de l'auto-participation
            autoParticipation: {
                maxParticipationsPerDay: 50,
                delayBetweenParticipations: 5 * 60 * 1000, // 5 minutes
                priorityThreshold: 4,
                safeMode: true,
                workingHours: {
                    start: '09:00',
                    end: '23:00'
                },
                maxRetries: 3,
                timeoutMs: 30000
            },

            // Configuration des performances
            performance: {
                analytics: {
                    maxTimePerOperation: 50, // ms
                    cacheExpirationMs: 10 * 60 * 1000 // 10 minutes
                },
                participation: {
                    maxTimePerOperation: 100, // ms
                    batchSize: 10
                },
                memory: {
                    maxMemoryPerItem: 10 * 1024, // 10KB
                    cleanupIntervalMs: 30 * 60 * 1000 // 30 minutes
                }
            },

            // Configuration des notifications
            notifications: {
                checkIntervalMs: 5 * 60 * 1000, // 5 minutes
                displayDurationMs: 5000, // 5 secondes
                maxNotifications: 50,
                types: {
                    success: { priority: 1, color: '#28a745' },
                    warning: { priority: 2, color: '#ffc107' },
                    error: { priority: 3, color: '#dc3545' },
                    info: { priority: 0, color: '#17a2b8' }
                }
            },

            // Configuration de la sécurité
            security: {
                allowedDomains: [
                    'sephora.fr',
                    'marionnaud.fr',
                    'yves-rocher.fr',
                    'loccitane.fr',
                    'kiehls.fr',
                    'douglas.fr'
                ],
                blacklistedDomains: [
                    'scam-site.com',
                    'fake-contests.net',
                    'phishing-attempt.org'
                ],
                requireHttps: true,
                maxValueThreshold: 1000,
                minValueThreshold: 0
            },

            // Configuration des analytics
            analytics: {
                dataRetentionDays: 365,
                aggregationIntervals: {
                    hour: 60 * 60 * 1000,
                    day: 24 * 60 * 60 * 1000,
                    week: 7 * 24 * 60 * 60 * 1000,
                    month: 30 * 24 * 60 * 60 * 1000
                },
                exportFormats: ['CSV', 'JSON', 'Excel'],
                chartColors: {
                    primary: '#007bff',
                    success: '#28a745',
                    warning: '#ffc107',
                    danger: '#dc3545'
                }
            },

            // Configuration de l'interface
            ui: {
                theme: 'auto', // light, dark, auto
                language: 'fr',
                dateFormat: 'DD/MM/YYYY',
                timeFormat: '24h',
                pagination: {
                    defaultPageSize: 25,
                    options: [10, 25, 50, 100]
                }
            },

            // Configuration des rapports email
            emailReports: {
                frequency: 'daily', // daily, weekly, monthly
                time: '20:00',
                maxRecipients: 10,
                includeCharts: true,
                includeStats: true,
                includePredictions: false
            },

            // Limites du système
            limits: {
                maxOpportunities: 10000,
                maxFileSize: 5 * 1024 * 1024, // 5MB
                apiTimeout: 30000,
                maxConcurrentRequests: 5
            }
        };

        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('app_config');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = this.mergeConfig(this.config, savedConfig);
            }
        } catch (error) {
            console.warn('Erreur lors du chargement de la configuration:', error);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('app_config', JSON.stringify(this.config));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la configuration:', error);
        }
    }

    mergeConfig(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        Object.keys(userConfig).forEach(key => {
            if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
                merged[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
            } else {
                merged[key] = userConfig[key];
            }
        });
        
        return merged;
    }

    get(path) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveToStorage();
    }

    reset(section = null) {
        if (section) {
            // Réinitialiser une section spécifique
            const defaultValue = this.getDefaultValue(section);
            if (defaultValue !== undefined) {
                this.set(section, defaultValue);
            }
        } else {
            // Réinitialiser toute la configuration
            localStorage.removeItem('app_config');
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        // Retourne la configuration par défaut (sans modifications utilisateur)
        return new ConfigManager().config;
    }

    getDefaultValue(path) {
        const defaultConfig = this.getDefaultConfig();
        const keys = path.split('.');
        let value = defaultConfig;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    validate() {
        const errors = [];
        
        // Validation des plages horaires
        const startTime = this.get('autoParticipation.workingHours.start');
        const endTime = this.get('autoParticipation.workingHours.end');
        
        if (startTime >= endTime) {
            errors.push('L\'heure de début doit être antérieure à l\'heure de fin');
        }
        
        // Validation des seuils
        const maxParticipations = this.get('autoParticipation.maxParticipationsPerDay');
        if (maxParticipations <= 0 || maxParticipations > 200) {
            errors.push('Le nombre maximum de participations doit être entre 1 et 200');
        }
        
        // Validation des délais
        const delay = this.get('autoParticipation.delayBetweenParticipations');
        if (delay < 1000) { // Minimum 1 seconde
            errors.push('Le délai entre participations doit être d\'au moins 1 seconde');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }

    importConfig(configJson) {
        try {
            const imported = JSON.parse(configJson);
            this.config = this.mergeConfig(this.getDefaultConfig(), imported);
            this.saveToStorage();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Instance globale
const AppConfig = new ConfigManager();

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
    module.exports.AppConfig = AppConfig;
} else if (typeof window !== 'undefined') {
    window.AppConfig = AppConfig;
}