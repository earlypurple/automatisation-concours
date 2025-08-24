// notifications.js
const Utils = require('./utils.js');

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.permission = 'default';
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isOnline = navigator.onLine || true;
        
        // Configuration moderne
        this.config = {
            enableWebSocket: true,
            enableServiceWorker: true,
            autoReconnect: true,
            notificationSound: true,
            vibration: true,
            maxNotifications: 50,
            retryInterval: 5000
        };
        
        // Ne pas appeler init automatiquement pour les tests
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
        // WebSocket moderne avec auto-reconnexion
        this.setupWebSocket();
        
        // Service Worker pour PWA et notifications
        this.setupServiceWorker();
        
        // Écouter les changements de connectivité
        window.addEventListener('online', () => {
            this.isOnline = true;
            if (this.config.autoReconnect) {
                this.setupWebSocket();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    setupWebSocket() {
        if (!this.config.enableWebSocket || !this.isOnline) return;
        
        try {
            // Fermer la connexion existante si elle existe
            if (this.websocket) {
                this.websocket.close();
            }
            
            const wsUrl = `ws://${window.location.hostname}:8080/notifications`;
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connecté pour les notifications');
                this.reconnectAttempts = 0;
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.showNotification(data.title, {
                        body: data.message,
                        type: data.type || 'info',
                        requireInteraction: data.requireInteraction || false,
                        url: data.url
                    });
                } catch (e) {
                    console.error('Erreur parsing message WebSocket:', e);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('Erreur WebSocket:', error);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket fermé');
                
                // Auto-reconnexion avec backoff exponentiel
                if (this.config.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts && this.isOnline) {
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    this.reconnectAttempts++;
                    
                    setTimeout(() => {
                        console.log(`Tentative de reconnexion WebSocket ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        this.setupWebSocket();
                    }, delay);
                }
            };
            
        } catch (error) {
            console.error('Erreur création WebSocket:', error);
        }
    }

    setupServiceWorker() {
        if (!this.config.enableServiceWorker || !('serviceWorker' in navigator)) return;
        
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker enregistré:', registration);
                
                // Écouter les messages du service worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.type === 'notification') {
                        this.showNotification(event.data.title, event.data.options);
                    }
                });
            })
            .catch(error => {
                console.error('Erreur ServiceWorker:', error);
            });
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
            timestamp: new Date().toISOString(),
            read: false,
            url: options.url
        };

        // Gérer la limite de notifications
        if (this.notifications.length >= this.config.maxNotifications) {
            this.notifications = this.notifications.slice(-this.config.maxNotifications + 1);
        }

        this.notifications.push(notification);
        this.saveNotifications();
        this.updateUI();

        // Notification système avec fonctionnalités modernes
        if ('Notification' in window) {
            const systemNotification = new Notification(title, {
                body: options.body,
                icon: '/static/images/icon-192.png',
                badge: '/static/images/badge-72.png',
                tag: notification.id,
                renotify: true,
                requireInteraction: options.requireInteraction || false,
                silent: !this.config.notificationSound,
                data: { 
                    url: options.url,
                    notificationId: notification.id
                },
                actions: options.url ? [
                    { action: 'view', title: 'Voir', icon: '/static/images/view-icon.png' },
                    { action: 'dismiss', title: 'Ignorer', icon: '/static/images/dismiss-icon.png' }
                ] : []
            });

            // Gestion des clics sur la notification
            systemNotification.onclick = () => {
                if (options.url) {
                    window.open(options.url, '_blank');
                }
                this.markAsRead(notification.id);
                systemNotification.close();
            };

            // Auto-fermeture après 5 secondes sauf si requireInteraction
            if (!options.requireInteraction) {
                setTimeout(() => {
                    systemNotification.close();
                }, 5000);
            }
        }

        // Vibration sur mobile si supportée
        if (this.config.vibration && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }

        // Son de notification (si activé)
        if (this.config.notificationSound) {
            this.playNotificationSound(options.type);
        }

        // Notification toast dans l'interface
        this.showToast(notification);
    }

    playNotificationSound(type = 'info') {
        try {
            const audio = new Audio();
            switch (type) {
                case 'success':
                    audio.src = '/static/sounds/success.mp3';
                    break;
                case 'warning':
                    audio.src = '/static/sounds/warning.mp3';
                    break;
                case 'error':
                    audio.src = '/static/sounds/error.mp3';
                    break;
                default:
                    audio.src = '/static/sounds/notification.mp3';
            }
            
            audio.volume = 0.3;
            audio.play().catch(e => {
                // Les navigateurs bloquent souvent l'autoplay audio
                console.log('Son de notification bloqué par le navigateur');
            });
        } catch (e) {
            console.error('Erreur lecture son notification:', e);
        }
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
            this.updateUI();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.updateUI();
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
