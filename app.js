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
        searchInput?.addEventListener('input', (e) => this.filterOpportunities(e.target.value));

        // Filtres
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => this.toggleFilter(tag));
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
    }

    renderOpportunities() {
        const grid = document.getElementById('opportunitiesGrid');
        grid.innerHTML = '';

        const filteredOpps = this.filterOpportunities(
            document.querySelector('.search-bar')?.value || ''
        );

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
                <button onclick="app.copyLink('${opp.url}', '${opp.title}')" class="btn btn-secondary">📋 Copier</button>
            </div>
            <div class="participation-tracker">
                <div class="checkbox" onclick="app.toggleParticipation(this)"></div>
                <span>Participé</span>
            </div>
        `;

        return card;
    }

    filterOpportunities(search) {
        let filtered = [...this.opportunities];
        
        // Filtres actifs
        if (this.filters.size > 0) {
            filtered = filtered.filter(opp => 
                this.filters.has('all') || this.filters.has(opp.type)
            );
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
}

// Initialisation
const app = new App();

// Export pour PWA
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SurveillanceApp;
}
