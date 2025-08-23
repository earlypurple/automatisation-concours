// emailReports.js
const Utils = require('./utils.js');
const Analytics = require('./analytics.js');

class EmailReportManager {
    constructor() {
        this.config = {
            enabled: true,
            frequency: 'daily', // daily, weekly, monthly
            time: '20:00',
            recipients: [],
            includeStats: true,
            includeCharts: true,
            includePredictions: true
        };
        // this.init(); // Ne pas appeler init automatiquement pour les tests
    }

    init() {
        this.loadConfig();
        this.setupSchedule();
    }

    loadConfig() {
        const savedConfig = Utils.getLocalStorage('email_report_config');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
    }

    saveConfig() {
        Utils.setLocalStorage('email_report_config', this.config);
    }

    setupSchedule() {
        const scheduleTime = () => {
            const [hours, minutes] = this.config.time.split(':');
            const now = new Date();
            const scheduledTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                parseInt(hours),
                parseInt(minutes)
            );

            if (scheduledTime < now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            const delay = scheduledTime.getTime() - now.getTime();
            setTimeout(() => {
                this.sendReport();
                this.setupSchedule(); // Replanifier pour le prochain jour
            }, delay);
        };

        scheduleTime();
    }

    async generateReport() {
        // Récupération des données
        const analytics = new Analytics();
        const stats = analytics.getStats();
        const charts = analytics.generateCharts();
        const predictions = await this.generatePredictions();

        // Génération du HTML
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
                    .chart { margin: 20px 0; }
                    .predictions { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Rapport de Surveillance Pro - ${new Date().toLocaleDateString()}</h1>
                    
                    <h2>📊 Statistiques</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3>Participations Totales</h3>
                            <p>${stats.total.participations}</p>
                        </div>
                        <div class="stat-card">
                            <h3>Taux de Succès</h3>
                            <p>${stats.total.successRate}%</p>
                        </div>
                        <div class="stat-card">
                            <h3>Valeur Totale</h3>
                            <p>${Utils.formatPrice(stats.total.value)}</p>
                        </div>
                        <div class="stat-card">
                            <h3>Moyenne Quotidienne</h3>
                            <p>${stats.last30Days.participations / 30}</p>
                        </div>
                    </div>

                    ${this.config.includeCharts ? `
                        <h2>📈 Graphiques</h2>
                        <div class="chart">
                            <img src="${this.generateChartImage(charts.participationsTrend)}" alt="Tendance des participations">
                        </div>
                        <div class="chart">
                            <img src="${this.generateChartImage(charts.categoryValue)}" alt="Valeur par catégorie">
                        </div>
                    ` : ''}

                    ${this.config.includePredictions ? `
                        <h2>🔮 Prédictions</h2>
                        <div class="predictions">
                            <h3>Pour les 7 prochains jours :</h3>
                            <ul>
                                ${predictions.map(p => `
                                    <li>${p.day}: ${p.prediction} opportunités attendues</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `;
    }

    async generatePredictions() {
        // Analyse des tendances et prédictions
        const analytics = new Analytics();
        const stats = analytics.getStats();
        const trends = stats.trends;

        // Calcul des prédictions pour les 7 prochains jours
        const predictions = [];
        const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayName = daysOfWeek[date.getDay()];

            // Algorithme de prédiction simple basé sur les moyennes et les tendances
            const prediction = Math.round(
                (trends.lastWeek.participations / 7) * 
                (1 + (trends.today.participations - trends.yesterday.participations) / trends.yesterday.participations)
            );

            predictions.push({
                day: dayName,
                prediction: Math.max(0, prediction)
            });
        }

        return predictions;
    }

    generateChartImage(data) {
        // Utilisation de Chart.js pour générer des images de graphiques
        // Cette fonction serait implémentée avec une bibliothèque de génération de graphiques côté serveur
        return `data:image/png;base64,...`;
    }

    async sendReport() {
        if (!this.config.enabled || this.config.recipients.length === 0) {
            return;
        }

        try {
            const html = await this.generateReport();
            
            // Envoi via l'API
            await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({
                    to: this.config.recipients,
                    subject: `Rapport Surveillance Pro - ${new Date().toLocaleDateString()}`,
                    html: html
                })
            });

            console.log('Rapport envoyé avec succès');
        } catch (error) {
            console.error('Erreur envoi rapport:', error);
        }
    }

    addRecipient(email) {
        if (Utils.validateEmail(email) && !this.config.recipients.includes(email)) {
            this.config.recipients.push(email);
            this.saveConfig();
            return true;
        }
        return false;
    }

    removeRecipient(email) {
        const index = this.config.recipients.indexOf(email);
        if (index !== -1) {
            this.config.recipients.splice(index, 1);
            this.saveConfig();
            return true;
        }
        return false;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        this.setupSchedule(); // Replanifier avec la nouvelle configuration
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailReportManager;
}
