// analytics.js
const Utils = require('./utils.js');

class Analytics {
    constructor() {
        this.data = {
            participations: [],
            successes: [],
            failures: [],
            totalValue: 0,
            categories: {}
        };
        // this.init(); // Ne pas appeler init automatiquement pour les tests
    }

    init() {
        this.loadData();
        this.setupTracking();
    }

    loadData() {
        this.data = Utils.getLocalStorage('analytics_data', {
            participations: [],
            successes: [],
            failures: [],
            totalValue: 0,
            categories: {}
        });
    }

    saveData() {
        Utils.setLocalStorage('analytics_data', this.data);
    }

    trackParticipation(opportunity) {
        const participation = {
            id: Utils.generateUUID(),
            opportunityId: opportunity.id,
            type: opportunity.type,
            value: opportunity.value,
            timestamp: new Date().toISOString()
        };

        this.data.participations.push(participation);
        this.data.totalValue += opportunity.value;

        // Mise à jour des catégories
        this.data.categories[opportunity.type] = this.data.categories[opportunity.type] || {
            count: 0,
            totalValue: 0
        };
        this.data.categories[opportunity.type].count++;
        this.data.categories[opportunity.type].totalValue += opportunity.value;

        this.saveData();
        this.updateUI();
    }

    trackSuccess(participationId) {
        const participation = this.data.participations.find(p => p.id === participationId);
        if (participation) {
            this.data.successes.push({
                participationId,
                timestamp: new Date().toISOString()
            });
            this.saveData();
            this.updateUI();
        }
    }

    trackFailure(participationId, reason) {
        const participation = this.data.participations.find(p => p.id === participationId);
        if (participation) {
            this.data.failures.push({
                participationId,
                reason,
                timestamp: new Date().toISOString()
            });
            this.saveData();
            this.updateUI();
        }
    }

    getStats() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const recentParticipations = this.data.participations.filter(p => 
            new Date(p.timestamp) > thirtyDaysAgo
        );

        const successRate = (this.data.successes.length / this.data.participations.length) * 100 || 0;

        return {
            total: {
                participations: this.data.participations.length,
                successes: this.data.successes.length,
                failures: this.data.failures.length,
                value: this.data.totalValue,
                successRate: successRate.toFixed(1)
            },
            last30Days: {
                participations: recentParticipations.length,
                value: recentParticipations.reduce((sum, p) => sum + p.value, 0)
            },
            categories: this.data.categories,
            trends: this.calculateTrends()
        };
    }

    calculateTrends() {
        const periods = {
            today: new Date(),
            yesterday: new Date(Date.now() - 24 * 60 * 60 * 1000),
            lastWeek: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            lastMonth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        };

        const trends = {};

        for (const [period, date] of Object.entries(periods)) {
            trends[period] = {
                participations: this.data.participations.filter(p => 
                    new Date(p.timestamp) > date
                ).length,
                value: this.data.participations.filter(p => 
                    new Date(p.timestamp) > date
                ).reduce((sum, p) => sum + p.value, 0),
                successes: this.data.successes.filter(s => 
                    new Date(s.timestamp) > date
                ).length
            };
        }

        return trends;
    }

    generateReport() {
        const stats = this.getStats();
        return {
            timestamp: new Date().toISOString(),
            stats,
            charts: this.generateCharts(),
            recommendations: this.generateRecommendations(stats)
        };
    }

    generateCharts() {
        // Préparation des données pour les graphiques
        const participationsByDay = {};
        const valueByCategory = {};
        const successRateByType = {};

        this.data.participations.forEach(p => {
            const date = p.timestamp.split('T')[0];
            participationsByDay[date] = (participationsByDay[date] || 0) + 1;

            valueByCategory[p.type] = (valueByCategory[p.type] || 0) + p.value;
        });

        Object.entries(this.data.categories).forEach(([type, data]) => {
            const successes = this.data.successes.filter(s => {
                const participation = this.data.participations.find(p => p.id === s.participationId);
                return participation && participation.type === type;
            }).length;

            successRateByType[type] = (successes / data.count) * 100;
        });

        return {
            participationsTrend: participationsByDay,
            categoryValue: valueByCategory,
            successRates: successRateByType
        };
    }

    generateRecommendations(stats) {
        const recommendations = [];

        // Analyse des tendances
        if (stats.trends.today.participations < stats.trends.yesterday.participations) {
            recommendations.push({
                type: 'warning',
                message: "Baisse des participations aujourd'hui",
                action: 'Augmenter la fréquence de scan'
            });
        }

        // Analyse des catégories
        const categories = Object.entries(stats.categories);
        if (categories.length > 0) {
            const bestCategory = categories.sort((a, b) => b[1].totalValue - a[1].totalValue)[0];
            recommendations.push({
                type: 'success',
                message: `${bestCategory[0]} est votre meilleure catégorie`,
                action: "Concentrez-vous sur ce type d'opportunités"
            });
        }

        // Analyse du taux de succès
        if (parseFloat(stats.total.successRate) < 50) {
            recommendations.push({
                type: 'error',
                message: 'Taux de succès faible',
                action: "Vérifier les raisons des échecs"
            });
        }

        return recommendations;
    }

    setupTracking() {
        // Event listeners pour le tracking automatique
        document.addEventListener('click', event => {
            const participateBtn = event.target.closest('.btn-primary');
            if (participateBtn) {
                const opportunityId = participateBtn.dataset.opportunityId;
                if (opportunityId) {
                    const opportunity = app.opportunities.find(o => o.id === opportunityId);
                    if (opportunity) {
                        this.trackParticipation(opportunity);
                    }
                }
            }
        });
    }

    updateUI() {
        const stats = this.getStats();
        
        // Mise à jour des compteurs
        document.getElementById('totalParticipations').textContent = stats.total.participations;
        document.getElementById('totalSuccesses').textContent = stats.total.successes;
        document.getElementById('totalValue').textContent = Utils.formatPrice(stats.total.value);
        document.getElementById('successRate').textContent = `${stats.total.successRate}%`;

        // Mise à jour des graphiques si Chart.js est disponible
        if (window.Chart) {
            this.updateCharts(this.generateCharts());
        }

        // Mise à jour des recommandations
        const recommendations = this.generateRecommendations(stats);
        this.displayRecommendations(recommendations);
    }

    updateCharts(chartData) {
        // Mise à jour des graphiques avec Chart.js
        // (Le code des graphiques serait ici)
    }

    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendationsContainer');
        if (!container) return;

        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation ${rec.type}">
                <strong>${rec.message}</strong>
                <p>${rec.action}</p>
            </div>
        `).join('');
    }

    exportData(format = 'json') {
        const data = {
            stats: this.getStats(),
            participations: this.data.participations,
            successes: this.data.successes,
            failures: this.data.failures,
            exported_at: new Date().toISOString()
        };

        if (format === 'csv') {
            // Conversion en CSV
            const csv = this.convertToCSV(data);
            Utils.downloadFile(csv, 'analytics_export.csv', 'text/csv');
        } else {
            // Export JSON
            Utils.downloadFile(
                JSON.stringify(data, null, 2),
                'analytics_export.json',
                'application/json'
            );
        }
    }

    convertToCSV(data, options = {}) {
        // Options par défaut
        const defaultOptions = {
            delimiter: ',',
            includeHeaders: true,
            dateFormat: 'ISO', // ISO, FR, US
            encoding: 'UTF-8',
            escapeQuotes: true
        };
        
        const config = { ...defaultOptions, ...options };
        
        if (!data || data.length === 0) {
            return 'Aucune donnée à exporter';
        }

        let headers, rows;
        
        if (data.participations && Array.isArray(data.participations)) {
            // Export des participations avec plus de détails
            headers = [
                'Date', 'Heure', 'Titre', 'Catégorie', 'Valeur', 
                'Statut', 'Tentatives', 'Durée (ms)', 'URL', 'ID'
            ];
            rows = data.participations.map(p => [
                this.formatDate(p.timestamp, config.dateFormat),
                this.formatTime(p.timestamp),
                this.escapeCSV(p.title || '', config),
                this.escapeCSV(p.category || '', config),
                p.value || 0,
                p.success ? 'Succès' : 'Échec',
                p.attempts || 1,
                p.duration || 0,
                this.escapeCSV(p.url || '', config),
                p.id || ''
            ]);
        } else if (data.analytics && typeof data.analytics === 'object') {
            // Export des analytics avec statistiques détaillées
            headers = ['Période', 'Participations', 'Succès', 'Taux Succès (%)', 'Valeur Totale'];
            rows = Object.entries(data.analytics).map(([period, stats]) => [
                this.escapeCSV(period, config),
                stats.participations || 0,
                stats.successes || 0,
                stats.participations > 0 ? ((stats.successes / stats.participations) * 100).toFixed(2) : 0,
                stats.totalValue || 0
            ]);
        } else if (data.categories && typeof data.categories === 'object') {
            // Export par catégories
            headers = ['Catégorie', 'Participations', 'Succès', 'Valeur Moyenne', 'Dernière Participation'];
            rows = Object.entries(data.categories).map(([category, stats]) => [
                this.escapeCSV(category, config),
                stats.count || 0,
                stats.successes || 0,
                stats.count > 0 ? (stats.totalValue / stats.count).toFixed(2) : 0,
                stats.lastParticipation ? this.formatDate(stats.lastParticipation, config.dateFormat) : 'Jamais'
            ]);
        } else if (Array.isArray(data)) {
            // Export générique d'un array d'objets amélioré
            if (data.length > 0) {
                headers = Object.keys(data[0]);
                rows = data.map(item => 
                    headers.map(header => {
                        const value = item[header];
                        if (value instanceof Date) {
                            return this.formatDate(value.toISOString(), config.dateFormat);
                        }
                        if (typeof value === 'string') {
                            return this.escapeCSV(value, config);
                        }
                        if (typeof value === 'object' && value !== null) {
                            return this.escapeCSV(JSON.stringify(value), config);
                        }
                        return value !== null && value !== undefined ? value : '';
                    })
                );
            } else {
                return 'Aucune donnée à exporter';
            }
        } else {
            // Export d'un objet de statistiques
            headers = ['Métrique', 'Valeur', 'Type'];
            rows = Object.entries(data).map(([key, value]) => [
                this.escapeCSV(key, config),
                typeof value === 'object' && value !== null ? this.escapeCSV(JSON.stringify(value), config) : value,
                typeof value
            ]);
        }

        // Construction du CSV
        const csvParts = [];
        
        if (config.includeHeaders) {
            csvParts.push(headers.join(config.delimiter));
        }
        
        csvParts.push(...rows.map(row => row.join(config.delimiter)));
        
        const csvContent = csvParts.join('\n');
        
        // Ajout du BOM pour UTF-8 si nécessaire
        if (config.encoding === 'UTF-8-BOM') {
            return '\uFEFF' + csvContent;
        }
        
        return csvContent;
    }

    formatDate(dateString, format = 'ISO') {
        const date = new Date(dateString);
        
        switch (format) {
            case 'FR':
                return date.toLocaleDateString('fr-FR');
            case 'US':
                return date.toLocaleDateString('en-US');
            case 'ISO':
            default:
                return date.toISOString().split('T')[0];
        }
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('fr-FR');
    }

    escapeCSV(value, config) {
        if (typeof value !== 'string') return value;
        
        const stringValue = String(value);
        
        // Échapper les guillemets si nécessaire
        if (config.escapeQuotes && stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        // Ajouter des guillemets si le contenu contient le délimiteur ou des retours à la ligne
        if (stringValue.includes(config.delimiter) || stringValue.includes('\n') || stringValue.includes('\r')) {
            return `"${stringValue}"`;
        }
        
        return stringValue;
    }

    exportToCSV(data, filename, options = {}) {
        const csvContent = this.convertToCSV(data, options);
        
        // Utiliser Utils pour télécharger le fichier
        if (typeof Utils !== 'undefined' && Utils.downloadFile) {
            const contentType = options.encoding === 'UTF-8-BOM' 
                ? 'text/csv;charset=utf-8' 
                : 'text/csv';
            
            Utils.downloadFile(csvContent, filename, contentType);
        } else {
            // Fallback pour environnement Node.js
            console.log('CSV Content:');
            console.log(csvContent);
        }
        
        return csvContent;
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
}
