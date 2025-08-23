// autoParticipation.js
class AutoParticipationManager {
    constructor() {
        this.config = {
            maxParticipationsPerDay: 50,
            safeMode: true,
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
        const response = await fetch('/api/data');
        const data = await response.json();
        return data.opportunities;
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
        // Vérifications de sécurité
        const validations = [
            this.validateUrl(opportunity.url),
            this.validateExpiration(opportunity.expires_at),
            this.validateValue(opportunity.value),
            this.checkBlacklist(opportunity.url)
        ];

        const results = await Promise.all(validations);
        if (!results.every(r => r)) {
            throw new Error('Validation de sécurité échouée');
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
        const user = auth.getUser();
        
        return {
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            // ... autres champs selon le type
        };
    }

    async submitParticipation(url, formData) {
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
        await fetch(`/api/opportunities/${opportunity.id}/participate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            }
        });
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
        const notification = {
            title: success ? '✅ Participation réussie' : '❌ Échec de participation',
            message: `${opportunity.title} - ${opportunity.value}€`,
            type: success ? 'success' : 'error'
        };
        
        notifications.showNotification(notification.title, {
            body: notification.message,
            type: notification.type
        });
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
