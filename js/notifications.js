// notifications.js
const Utils = require('./utils.js');

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.permission = 'default';
        // this.init(); // Ne pas appeler init automatiquement pour les tests
    }

    async init() {
        this.loadNotifications();
        await this.requestPermission();
        this.setupEventListeners();
        this.startPeriodicCheck();
    }

    loadNotifications() {
        this.notifications = Utils.getLocalStorage('notifications', []);
    }

    saveNotifications() {
        Utils.setLocalStorage('notifications', this.notifications);
    }

    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
        }
    }

    setupEventListeners() {
        // Écoute des nouveaux messages WebSocket
        if ('WebSocket' in window) {
            const ws = new WebSocket('ws://localhost:8080/notifications');
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.showNotification(data.title, data.message);
            };
        }

        // Service Worker pour les notifications push
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                })
                .catch(error => {
                    console.error('ServiceWorker error:', error);
                });
        }
    }

    startPeriodicCheck() {
        // Vérification périodique des nouvelles opportunités
        setInterval(() => {
            this.checkNewOpportunities();
        }, 5 * 60 * 1000); // Toutes les 5 minutes
    }

    async showNotification(title, options = {}) {
        if (this.permission !== 'granted') return;

        const notification = {
            id: Utils.generateUUID(),
            title,
            message: options.body || '',
            type: options.type || 'info',
            timestamp: new Date().toISOString()
        };

        this.notifications.push(notification);
        this.saveNotifications();
        this.updateUI();

        // Notification du système
        if ('Notification' in window) {
            new Notification(title, {
                body: options.body,
                icon: '/img/icon.png',
                badge: '/img/badge.png',
                tag: notification.id,
                renotify: true,
                requireInteraction: options.requireInteraction || false,
                data: { url: options.url }
            });
        }

        // Notification toast dans l'interface
        this.showToast(notification);
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = `toast ${notification.type}`;
        toast.innerHTML = `
            <div class="toast-header">
                <strong>${notification.title}</strong>
                <small>${Utils.getTimeAgo(notification.timestamp)}</small>
                <button onclick="this.closest('.toast').remove()">×</button>
            </div>
            <div class="toast-body">
                ${notification.message}
            </div>
        `;

        document.body.appendChild(toast);
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-destruction après 5 secondes
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    async checkNewOpportunities() {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            
            const newOpportunities = data.opportunities.filter(opp => {
                const timestamp = new Date(opp.detected_at);
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                return timestamp > fiveMinutesAgo;
            });

            newOpportunities.forEach(opp => {
                this.showNotification(
                    'Nouvelle opportunité !',
                    {
                        body: `${opp.title} - Valeur: ${opp.value}€`,
                        type: opp.priority >= 5 ? 'high' : 'normal',
                        url: opp.url,
                        requireInteraction: opp.priority >= 5
                    }
                );
            });
        } catch (error) {
            console.error('Erreur lors de la vérification:', error);
        }
    }

    markAsRead(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            this.notifications[index].read = true;
            this.saveNotifications();
            this.updateUI();
        }
    }

    deleteNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveNotifications();
        this.updateUI();
    }

    clearAll() {
        this.notifications = [];
        this.saveNotifications();
        this.updateUI();
    }

    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    updateUI() {
        // Mise à jour du compteur dans la barre de navigation
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const count = this.getUnreadCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }

        // Mise à jour de la liste des notifications
        const container = document.getElementById('notificationsList');
        if (container) {
            container.innerHTML = this.notifications
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map(notification => `
                    <div class="notification-item ${notification.read ? 'read' : ''} ${notification.type}">
                        <div class="notification-content">
                            <h4>${notification.title}</h4>
                            <p>${notification.message}</p>
                            <small>${Utils.getTimeAgo(notification.timestamp)}</small>
                        </div>
                        <div class="notification-actions">
                            ${!notification.read ? `
                                <button onclick="notifications.markAsRead('${notification.id}')" class="btn-icon">
                                    ✓
                                </button>
                            ` : ''}
                            <button onclick="notifications.deleteNotification('${notification.id}')" class="btn-icon">
                                ×
                            </button>
                        </div>
                    </div>
                `).join('');
        }
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
