// app.js
class SurveillanceApp {
    constructor() {
        this.config = null;
        this.opportunities = [];
        this.stats = {};
        this.filters = new Set();
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.setupPWA();
        this.startAutoUpdate();
        await this.loadData();
    }

    async loadConfig() {
        try {
            const response = await fetch('/config.json');
            this.config = await response.json();
        } catch (error) {
            console.error('Erreur chargement config:', error);
        }
    }

    setupEventListeners() {
        // Thème
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('theme-dark');
            localStorage.setItem('theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
        });

        // Recherche
        const searchInput = document.querySelector('.search-bar');
        searchInput?.addEventListener('input', (e) => this.renderOpportunities());

        // Filtres
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => this.toggleFilter(tag));
        });

        // Boutons de contrôle
        document.getElementById('update-btn')?.addEventListener('click', () => this.loadData());
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportData());
        document.getElementById('notifications-btn')?.addEventListener('click', () => this.showNotification('Notifications non implémentées'));
        document.getElementById('analytics-btn')?.addEventListener('click', () => this.toggleAnalytics());

        // Event delegation pour les actions sur les opportunités
        const grid = document.getElementById('opportunitiesGrid');
        grid.addEventListener('click', (e) => {
            if (e.target.closest('.btn-secondary')) {
                const card = e.target.closest('.opportunity');
                const url = card.querySelector('a').href;
                const title = card.querySelector('h3').textContent;
                this.copyLink(url, title);
            }
            if (e.target.closest('.checkbox')) {
                this.toggleParticipation(e.target.closest('.checkbox'));
            }
        });
    }

    async setupPWA() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker enregistré:', registration);
            } catch (error) {
                console.error('Erreur ServiceWorker:', error);
            }
        }
    }

    startAutoUpdate() {
        setInterval(() => this.loadData(), this.config?.scraping?.interval_minutes * 60 * 1000 || 3600000);
    }

    async loadData() {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            this.opportunities = data.opportunities;
            this.stats = data.stats;
            this.updateUI();
        } catch (error) {
            this.showNotification('Erreur de chargement des données', 'error');
        }
    }

    updateUI() {
        // Mise à jour des stats
        document.getElementById('totalOpportunities').textContent = this.stats.total_found;
        document.getElementById('todayNew').textContent = this.stats.today_new;
        document.getElementById('totalValue').textContent = `€${this.stats.total_value}`;
        document.getElementById('successRate').textContent = `${this.stats.success_rate}%`;

        // Mise à jour de la grille d'opportunités
        this.renderOpportunities();
        this.renderCategoryChart();
    }

    renderOpportunities() {
        const grid = document.getElementById('opportunitiesGrid');
        grid.innerHTML = '';
        const search = document.querySelector('.search-bar')?.value || '';
        const filteredOpps = this.filterOpportunities(search);

        filteredOpps.forEach(opp => {
            const card = this.createOpportunityCard(opp);
            grid.appendChild(card);
        });
    }

    createOpportunityCard(opp) {
        const card = document.createElement('div');
        card.className = `opportunity ${opp.priority >= 5 ? 'priority-5' : ''} ${opp.type} fade-in`;
        card.setAttribute('data-value', opp.value);

        card.innerHTML = `
            ${opp.priority >= 5 ? '<div class="priority-badge">PRIORITÉ 5</div>' : ''}
            <h3>${opp.title}</h3>
            <p>${opp.description}</p>
            <div class="value-box">
                <strong>Valeur :</strong> ${opp.value}€
                <br><strong>Expire :</strong> ${new Date(opp.expires_at).toLocaleDateString()}
            </div>
            <div class="actions">
                <a href="${opp.url}" target="_blank" class="btn btn-primary pulse">🚀 Participer</a>
                <button class="btn btn-secondary">📋 Copier</button>
            </div>
            <div class="participation-tracker">
                <div class="checkbox"></div>
                <span>Participé</span>
            </div>
        `;

        return card;
    }

    filterOpportunities(search) {
        let filtered = [...this.opportunities];
        const activeFilter = this.filters.values().next().value;

        // Filtres actifs
        if (activeFilter && activeFilter !== 'all') {
            if (activeFilter === 'priority-5') {
                 filtered = filtered.filter(opp => opp.priority >= 5);
            } else {
                 filtered = filtered.filter(opp => opp.type === activeFilter);
            }
        }

        // Recherche
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(opp =>
                opp.title.toLowerCase().includes(searchLower) ||
                opp.description.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    toggleFilter(tag) {
        const type = tag.getAttribute('data-type');

        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');

        this.filters.clear();
        this.filters.add(type);

        this.renderOpportunities();
    }

    exportData() {
        const data = JSON.stringify({
            opportunities: this.opportunities,
            stats: this.stats
        }, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'surveillance_data.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Données exportées en JSON', 'success');
    }

    async copyLink(url, title) {
        try {
            await navigator.clipboard.writeText(url);
            this.showNotification(`Lien copié : ${title}`, 'success');
        } catch (err) {
            this.showNotification('Erreur de copie', 'error');
        }
    }

    toggleParticipation(checkbox) {
        checkbox.classList.toggle('checked');
        this.updateParticipationStats();
    }

    updateParticipationStats() {
        const participated = document.querySelectorAll('.checkbox.checked').length;
        document.getElementById('participationsCount').textContent = participated;
        
        const totalValue = Array.from(document.querySelectorAll('.checkbox.checked'))
            .reduce((sum, checkbox) => {
                const card = checkbox.closest('.opportunity');
                return sum + parseInt(card.getAttribute('data-value') || 0);
            }, 0);
        
        document.getElementById('totalValueToday').textContent = `€${totalValue}`;
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    toggleAnalytics() {
        const section = document.getElementById('analytics-section');
        if (section.style.display === 'none') {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }

    renderCategoryChart() {
        const categoryData = this.opportunities.reduce((acc, opp) => {
            acc[opp.type] = (acc[opp.type] || 0) + opp.value;
            return acc;
        }, {});

        const ctx = document.getElementById('category-chart').getContext('2d');

        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    label: 'Valeur totale par catégorie',
                    data: Object.values(categoryData),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                    ],
                    borderColor: 'rgba(255, 255, 255, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Valeur totale par catégorie'
                    }
                }
            }
        });
    }
}

// Initialisation
const app = new SurveillanceApp();

// Export pour PWA
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SurveillanceApp;
}
