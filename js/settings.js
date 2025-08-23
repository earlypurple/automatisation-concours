class SettingsApp {
    constructor() {
        this.profiles = [];
        this.proxies = [];
        this.config = {};
        this.init();
    }

    async init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        await this.loadGeneralSettings();
        await this.loadProfiles();
        await this.loadProxies();
    }

    cacheDOMElements() {
        // ... (existing profile elements)
        this.profilesList = document.getElementById('profiles-list');
        this.addProfileBtn = document.getElementById('add-profile-btn');
        this.profileFormContainer = document.getElementById('profile-form-container');
        this.profileFormTitle = document.getElementById('profile-form-title');
        this.profileIdInput = document.getElementById('profileId');
        this.profileNameInput = document.getElementById('profileName');
        this.profileEmailInput = document.getElementById('profileEmail');
        this.profileUserDataInput = document.getElementById('profileUserData');
        this.saveProfileBtn = document.getElementById('save-profile-btn');
        this.cancelProfileBtn = document.getElementById('cancel-profile-btn');

        // Proxy elements
        this.proxyInput = document.getElementById('proxy-input');
        this.addProxyBtn = document.getElementById('add-proxy-btn');
        this.proxyList = document.getElementById('proxy-list');

        // General settings elements
        this.saveGeneralBtn = document.getElementById('save-btn');
        this.desktopNotifications = document.getElementById('desktopNotifications');
        this.browserNotifications = document.getElementById('browserNotifications');
        this.minPriority = document.getElementById('minPriority');
        this.scrapingInterval = document.getElementById('scrapingInterval');
        this.autoParticipationEnabled = document.getElementById('autoParticipationEnabled');
        this.maxPerDay = document.getElementById('maxPerDay');

        // Telegram elements
        this.telegramEnabled = document.getElementById('telegramEnabled');
        this.telegramBotToken = document.getElementById('telegramBotToken');
        this.telegramChatId = document.getElementById('telegramChatId');

        this.toast = document.getElementById('toast');
    }

    setupEventListeners() {
        // Profile listeners
        this.addProfileBtn.addEventListener('click', () => this.showProfileForm(null));
        this.saveProfileBtn.addEventListener('click', () => this.saveProfile());
        this.cancelProfileBtn.addEventListener('click', () => this.hideProfileForm());

        // General settings listener
        this.saveGeneralBtn.addEventListener('click', () => this.saveGeneralSettings());

        this.profilesList.addEventListener('click', (e) => {
            if (e.target.matches('.edit-btn')) {
                const id = e.target.getAttribute('data-id');
                const profile = this.profiles.find(p => p.id == id);
                this.showProfileForm(profile);
            }
            if (e.target.matches('.delete-btn')) {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                if (confirm(`Êtes-vous sûr de vouloir supprimer le profil "${name}" ? Toutes les données associées seront perdues.`)) {
                    this.deleteProfile(id);
                }
            }
        });

        // Proxy listeners
        this.addProxyBtn.addEventListener('click', () => this.addProxy());
        this.proxyList.addEventListener('click', (e) => {
            if (e.target.matches('.delete-proxy-btn')) {
                const proxyUrl = e.target.getAttribute('data-proxy');
                if (confirm(`Êtes-vous sûr de vouloir supprimer le proxy "${proxyUrl}" ?`)) {
                    this.deleteProxy(proxyUrl);
                }
            }
        });
    }

    async loadProfiles() {
        try {
            const response = await fetch('/api/profiles');
            this.profiles = await response.json();
            this.renderProfiles();
        } catch (error) {
            this.showToast('Erreur de chargement des profils.', 'error');
        }
    }

    renderProfiles() {
        this.profilesList.innerHTML = this.profiles.map(p => `
            <div class="profile-item ${p.is_active ? 'active' : ''}">
                <span>${p.name} ${p.is_active ? '(Actif)' : ''}</span>
                <div class="profile-actions">
                    <button class="btn btn-sm btn-secondary edit-btn" data-id="${p.id}">Modifier</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${p.id}" data-name="${p.name}" ${this.profiles.length <= 1 ? 'disabled' : ''}>Supprimer</button>
                </div>
            </div>
        `).join('');
    }

    showProfileForm(profile) {
        if (profile) {
            this.profileFormTitle.textContent = 'Modifier le Profil';
            this.profileIdInput.value = profile.id;
            this.profileNameInput.value = profile.name;
            this.profileEmailInput.value = profile.email;
            this.profileUserDataInput.value = JSON.stringify(JSON.parse(profile.user_data), null, 2);
        } else {
            this.profileFormTitle.textContent = 'Ajouter un Profil';
            this.profileIdInput.value = '';
            this.profileNameInput.value = '';
            this.profileEmailInput.value = '';
            this.profileUserDataInput.value = JSON.stringify({ name: "", phone: "", address: "" }, null, 2);
        }
        this.profileFormContainer.style.display = 'block';
    }

    hideProfileForm() {
        this.profileFormContainer.style.display = 'none';
    }

    async saveProfile() {
        const id = this.profileIdInput.value;
        const name = this.profileNameInput.value;
        const email = this.profileEmailInput.value;
        let userData;

        if (!name) {
            this.showToast('Le nom du profil est obligatoire.', 'error');
            return;
        }

        try {
            userData = JSON.parse(this.profileUserDataInput.value);
        } catch (e) {
            this.showToast('Les données utilisateur ne sont pas un JSON valide.', 'error');
            return;
        }

        const profileData = { name, email, userData };
        const url = id ? `/api/profiles/${id}` : '/api/profiles';
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                this.showToast('Profil enregistré avec succès!', 'success');
                this.hideProfileForm();
                await this.loadProfiles();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            this.showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async deleteProfile(id) {
        try {
            const response = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
            if (response.ok) {
                this.showToast('Profil supprimé avec succès!', 'success');
                await this.loadProfiles();
            } else {
                 const result = await response.json();
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
             this.showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // --- Proxy Methods ---

    async loadProxies() {
        try {
            const response = await fetch('/api/proxies');
            this.proxies = await response.json();
            this.renderProxies();
        } catch (error) {
            this.showToast('Erreur de chargement des proxies.', 'error');
        }
    }

    renderProxies() {
        this.proxyList.innerHTML = this.proxies.map(proxy => `
            <li class="proxy-item">
                <span>${proxy}</span>
                <button class="btn btn-sm btn-danger delete-proxy-btn" data-proxy="${proxy}">Supprimer</button>
            </li>
        `).join('');
    }

    async addProxy() {
        const proxyUrl = this.proxyInput.value.trim();
        if (!proxyUrl) {
            this.showToast('Veuillez entrer une URL de proxy.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/proxies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxy_url: proxyUrl })
            });

            if (response.ok) {
                this.showToast('Proxy ajouté avec succès!', 'success');
                this.proxyInput.value = '';
                await this.loadProxies();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            this.showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async deleteProxy(proxyUrl) {
        try {
            const response = await fetch('/api/proxies', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxy_url: proxyUrl })
            });

            if (response.ok) {
                this.showToast('Proxy supprimé avec succès!', 'success');
                await this.loadProxies();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            this.showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    // --- General Settings Methods ---

    async loadGeneralSettings() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();
            this.populateGeneralSettings();
        } catch (error) {
            this.showToast('Erreur de chargement de la configuration générale.', 'error');
        }
    }

    populateGeneralSettings() {
        const notifications = this.config.notifications || {};
        const scraping = this.config.scraping || {};
        const autoPart = this.config.auto__participation || {};
        const telegram = notifications.telegram || {};

        this.desktopNotifications.checked = notifications.desktop;
        this.browserNotifications.checked = notifications.browser;
        this.minPriority.value = notifications.min_priority;

        this.telegramEnabled.checked = telegram.enabled;
        this.telegramBotToken.value = telegram.bot_token;
        this.telegramChatId.value = telegram.chat_id;

        this.scrapingInterval.value = scraping.interval_minutes;
        this.autoParticipationEnabled.checked = autoPart.enabled;
        this.maxPerDay.value = autoPart.max_per_day;
    }

    async saveGeneralSettings() {
        // Update the config object from the form fields
        this.config.notifications.desktop = this.desktopNotifications.checked;
        this.config.notifications.browser = this.browserNotifications.checked;
        this.config.notifications.min_priority = parseInt(this.minPriority.value, 10);

        this.config.notifications.telegram.enabled = this.telegramEnabled.checked;
        this.config.notifications.telegram.bot_token = this.telegramBotToken.value;
        this.config.notifications.telegram.chat_id = this.telegramChatId.value;

        this.config.scraping.interval_minutes = parseInt(this.scrapingInterval.value, 10);
        this.config.auto__participation.enabled = this.autoParticipationEnabled.checked;
        this.config.auto__participation.max_per_day = parseInt(this.maxPerDay.value, 10);

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });

            if (response.ok) {
                this.showToast('Paramètres généraux enregistrés!', 'success');
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            this.showToast(`Erreur: ${error.message}`, 'error');
        }
    }


    showToast(message, type = 'success') {
        this.toast.textContent = message;
        this.toast.className = `toast show ${type}`;
        setTimeout(() => {
            this.toast.className = this.toast.className.replace('show', '');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SettingsApp();
});
