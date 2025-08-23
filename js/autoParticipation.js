// autoParticipation.js
const DataValidator = require('./validator.js');

class AutoParticipationManager {
    constructor() {
        this.config = {
            maxParticipationsPerDay: 50,
            safeMode: false, // Disabled for testing by default
            startTime: '09:00',
            endTime: '23:00',
            delayBetween: 5 * 60 * 1000, // 5 minutes
            priorityThreshold: 4
        };
        this.running = false;
        this.stats = {
            participationsToday: 0,
            successesToday: 0,
            failuresToday: 0,
            lastParticipation: null
        };
        this.validator = new DataValidator();
    }

    async start() {
        if (this.running) return;
        this.running = true;
        console.log('🤖 Démarrage auto-participation...');
        await this.run();
    }

    stop() {
        this.running = false;
        console.log('🛑 Arrêt auto-participation');
    }

    async run() {
        while (this.running) {
            try {
                if (this.canParticipate()) {
                    await this.processNextOpportunity();
                }
                await this.sleep(this.config.delayBetween);
            } catch (error) {
                console.error('Erreur auto-participation:', error);
                await this.sleep(30000); // Attendre 30s en cas d'erreur
            }
        }
    }

    canParticipate() {
        // Vérification de l'heure
        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const [startHour, startMin] = this.config.startTime.split(':').map(Number);
        const [endHour, endMin] = this.config.endTime.split(':').map(Number);
        const startTime = startHour * 100 + startMin;
        const endTime = endHour * 100 + endMin;

        if (currentTime < startTime || currentTime > endTime) {
            return false;
        }

        // Vérification du nombre max de participations
        if (this.stats.participationsToday >= this.config.maxParticipationsPerDay) {
            return false;
        }

        // Vérification du délai entre participations
        if (this.stats.lastParticipation) {
            const timeSinceLastParticipation = Date.now() - this.stats.lastParticipation;
            if (timeSinceLastParticipation < this.config.delayBetween) {
                return false;
            }
        }

        return true;
    }

    async processNextOpportunity() {
        const opportunities = await this.fetchOpportunities();
        const nextOpp = this.selectBestOpportunity(opportunities);
        
        if (!nextOpp) return;

        try {
            const success = await this.participateInOpportunity(nextOpp);
            this.updateStats(success);
            this.notifyResult(nextOpp, success);
        } catch (error) {
            console.error(`Erreur participation ${nextOpp.title}:`, error);
            this.updateStats(false);
        }
    }

    async fetchOpportunities() {
        // En mode test, utiliser des données mockées
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
            return this.getMockOpportunities();
        }
        
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            return data.opportunities;
        } catch (error) {
            console.warn('API not available, using mock data');
            return this.getMockOpportunities();
        }
    }

    getMockOpportunities() {
        return [
            {
                id: 1,
                title: 'Test Échantillon Sephora',
                priority: 5,
                value: 50,
                auto_fill: true,
                participated: false,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                url: 'https://sephora.fr/test',
                category: 'beauty'
            },
            {
                id: 2,
                title: 'Concours Yves Rocher',
                priority: 4,
                value: 30,
                auto_fill: true,
                participated: false,
                expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                url: 'https://yves-rocher.fr/test',
                category: 'beauty'
            },
            {
                id: 3,
                title: 'Test Low Priority',
                priority: 2,
                value: 10,
                auto_fill: true,
                participated: false,
                expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                url: 'https://test.com/test',
                category: 'other'
            }
        ];
    }

    selectBestOpportunity(opportunities) {
        // Filtrage et tri des opportunités
        return opportunities
            .filter(opp => 
                opp.priority >= this.config.priorityThreshold &&
                opp.auto_fill &&
                !opp.participated &&
                new Date(opp.expires_at) > new Date()
            )
            .sort((a, b) => {
                // Priorité d'abord
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;
                }
                // Puis valeur
                if (b.value !== a.value) {
                    return b.value - a.value;
                }
                // Puis date d'expiration
                return new Date(a.expires_at) - new Date(b.expires_at);
            })[0];
    }

    async participateInOpportunity(opportunity) {
        if (this.config.safeMode) {
            await this.validateOpportunity(opportunity);
        }

        // Simuler le remplissage du formulaire
        const formData = this.prepareFormData(opportunity);
        
        // Envoi de la participation
        const success = await this.submitParticipation(opportunity.url, formData);
        
        if (success) {
            await this.markAsParticipated(opportunity);
        }

        return success;
    }

    async validateOpportunity(opportunity) {
        // Utiliser le validateur pour vérifier l'opportunité
        const validation = this.validator.validateOpportunity(opportunity);
        if (!validation.isValid) {
            console.error('Erreurs de validation:', validation.errors);
            throw new Error(`Validation échouée: ${validation.errors.join(', ')}`);
        }

        // Vérifications de sécurité supplémentaires
        const securityChecks = [
            this.validateUrl(opportunity.url),
            this.validateExpiration(opportunity.expires_at),
            this.validateValue(opportunity.value),
            this.checkBlacklist(opportunity.url)
        ];

        const results = await Promise.all(securityChecks);
        if (!results.every(r => r)) {
            throw new Error('Vérifications de sécurité échouées');
        }
    }

    async validateUrl(url) {
        // Vérification du domaine et des redirections
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const finalUrl = response.url;
            return this.isAllowedDomain(finalUrl);
        } catch {
            return false;
        }
    }

    validateExpiration(expiresAt) {
        const expiration = new Date(expiresAt);
        const now = new Date();
        return expiration > now;
    }

    validateValue(value) {
        // Vérification que la valeur est réaliste
        return value >= 0 && value <= 1000;
    }

    async checkBlacklist(url) {
        try {
            const blacklist = await this.loadBlacklist();
            return !blacklist.some(domain => url.includes(domain));
        } catch {
            return true; // En cas d'erreur, on continue
        }
    }

    prepareFormData(opportunity) {
        // Préparation des données de formulaire selon le type
        const rawUserData = this.getUserData();
        
        // Validation et nettoyage des données
        const validation = this.validator.validateUserData(rawUserData);
        if (!validation.isValid) {
            console.warn('Données utilisateur invalides:', validation.errors);
            // Utiliser des données par défaut sécurisées
        }

        const userData = this.validator.sanitizeUserData(rawUserData);

        const baseData = {
            name: userData.name || 'Test User',
            email: userData.email || 'test@example.com',
            phone: userData.phone || '0123456789',
            address: userData.address || '123 Test Street',
            city: userData.city || 'Paris',
            zipCode: userData.zipCode || '75001',
            country: userData.country || 'France'
        };

        // Ajout de champs spécifiques selon la catégorie
        if (opportunity.category === 'beauty') {
            baseData.skinType = userData.skinType || 'normal';
            baseData.age = userData.age || 25;
        } else if (opportunity.category === 'food') {
            baseData.dietaryRestrictions = userData.dietaryRestrictions || 'none';
        }

        return baseData;
    }

    getUserData() {
        // Récupération sécurisée des données utilisateur
        return {
            name: 'Test User',
            email: 'test@example.com',
            phone: '0123456789',
            address: '123 Test Street',
            city: 'Paris',
            zipCode: '75001',
            country: 'France',
            age: 25,
            skinType: 'normal',
            dietaryRestrictions: 'none'
        };
    }

    isAllowedDomain(url) {
        const allowedDomains = [
            'sephora.fr',
            'marionnaud.fr',
            'yves-rocher.fr',
            'loccitane.fr',
            'kiehls.fr',
            'douglas.fr'
        ];
        
        try {
            const domain = new URL(url).hostname.toLowerCase();
            return allowedDomains.some(allowed => domain.includes(allowed));
        } catch {
            return false;
        }
    }

    async loadBlacklist() {
        // Liste des domaines suspects
        return [
            'scam-site.com',
            'fake-contests.net',
            'phishing-attempt.org'
        ];
    }

    async submitParticipation(url, formData) {
        // En mode test, simuler le succès
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
            await this.sleep(Math.random() * 50 + 10); // Simuler un délai
            return Math.random() > 0.2; // 80% de taux de succès
        }

        try {
            const response = await fetch('/api/participate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    userData: formData
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Participation failed');
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error submitting participation:', error);
            return false;
        }
    }

    async markAsParticipated(opportunity) {
        // En mode test, ne pas faire d'appel API
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
            return;
        }

        try {
            await fetch(`/api/opportunities/${opportunity.id}/participate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });
        } catch (error) {
            console.warn('Could not mark as participated:', error.message);
        }
    }

    getAuthToken() {
        // Méthode pour récupérer le token d'authentification
        return 'test-token';
    }

    updateStats(success) {
        this.stats.participationsToday++;
        if (success) {
            this.stats.successesToday++;
        } else {
            this.stats.failuresToday++;
        }
        this.stats.lastParticipation = Date.now();
    }

    notifyResult(opportunity, success) {
        const message = success 
            ? `✅ Participation réussie: ${opportunity.title}` 
            : `❌ Échec de participation: ${opportunity.title}`;
        
        console.log(message);
        
        // Envoyer notification si disponible (seulement en environnement web)
        if (typeof window !== 'undefined' && window.notifications) {
            window.notifications.showNotification(
                success ? 'Participation réussie' : 'Échec de participation',
                {
                    body: opportunity.title,
                    type: success ? 'success' : 'error'
                }
            );
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Configuration et statistiques
    getStats() {
        return {
            ...this.stats,
            successRate: (this.stats.successesToday / this.stats.participationsToday * 100) || 0
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    reset() {
        this.stats = {
            participationsToday: 0,
            successesToday: 0,
            failuresToday: 0,
            lastParticipation: null
        };
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoParticipationManager;
}
