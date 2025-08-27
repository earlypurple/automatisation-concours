// realTimeMonitor.js
// Module de surveillance en temps réel avec WebSocket

class RealTimeMonitor {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.listeners = new Map();
        this.metrics = {
            participations: 0,
            success_rate: 0,
            queue_size: 0,
            response_time: 0,
            opportunities_found: 0,
            last_update: null
        };
        this.performanceBuffer = [];
        this.maxBufferSize = 100;
        this.timersStarted = false; // Flag to prevent multiple timers
        this.pollingInterval = null;
        this.metricsInterval = null;
        this.reconnectTimeout = null;
    }

    init() {
        this.connect();
        this.setupPerformanceTracking();
        this.startMetricsCollection();
    }

    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
    }

    connect() {
        try {
            // Utiliser WebSocket si disponible et en environnement navigateur
            if (typeof WebSocket !== 'undefined' && typeof window !== 'undefined') {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/monitor`;
                
                this.websocket = new WebSocket(wsUrl);
                this.setupWebSocketEvents();
            } else {
                // Fallback sur polling pour les environnements sans WebSocket ou Node.js
                this.startPolling();
            }
        } catch (error) {
            console.warn('WebSocket connection failed, falling back to polling:', error);
            this.startPolling();
        }
    }

    setupWebSocketEvents() {
        this.websocket.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('🔌 Real-time monitor connected');
            this.emit('connected');
        };

        this.websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('WebSocket message parsing error:', error);
            }
        };

        this.websocket.onclose = () => {
            this.isConnected = false;
            console.log('🔌 Real-time monitor disconnected');
            this.emit('disconnected');
            this.attemptReconnect();
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'metrics_update':
                this.updateMetrics(data.payload);
                break;
            case 'new_opportunity':
                this.handleNewOpportunity(data.payload);
                break;
            case 'participation_result':
                this.handleParticipationResult(data.payload);
                break;
            case 'performance_alert':
                this.handlePerformanceAlert(data.payload);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    updateMetrics(newMetrics) {
        // Mise à jour des métriques avec calcul des tendances
        const previousMetrics = { ...this.metrics };
        Object.assign(this.metrics, newMetrics);
        this.metrics.last_update = new Date().toISOString();

        // Calcul des tendances
        const trends = this.calculateTrends(previousMetrics, this.metrics);
        
        this.emit('metrics_updated', {
            metrics: this.metrics,
            trends: trends,
            timestamp: this.metrics.last_update
        });

        // Mise à jour de l'UI si disponible
        this.updateUI(this.metrics, trends);
    }

    calculateTrends(previous, current) {
        const trends = {};
        
        ['participations', 'success_rate', 'opportunities_found'].forEach(key => {
            if (previous[key] !== undefined && current[key] !== undefined) {
                const change = current[key] - previous[key];
                const percentChange = previous[key] > 0 ? (change / previous[key]) * 100 : 0;
                
                trends[key] = {
                    change: change,
                    percent_change: Math.round(percentChange * 100) / 100,
                    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
                };
            }
        });

        return trends;
    }

    handleNewOpportunity(opportunity) {
        this.emit('new_opportunity', opportunity);
        
        // Notification intelligente si priorité élevée
        if (opportunity.priority >= 8) {
            this.showPriorityNotification(opportunity);
        }
    }

    handleParticipationResult(result) {
        this.addToPerformanceBuffer(result);
        this.emit('participation_result', result);
        
        // Analytics en temps réel
        this.updateSuccessRate(result.success);
    }

    handlePerformanceAlert(alert) {
        this.emit('performance_alert', alert);
        console.warn('Performance alert:', alert);
        
        // Actions automatiques selon le type d'alerte
        this.handleAutoOptimization(alert);
    }

    addToPerformanceBuffer(result) {
        this.performanceBuffer.push({
            ...result,
            timestamp: Date.now()
        });

        // Maintenir la taille du buffer
        if (this.performanceBuffer.length > this.maxBufferSize) {
            this.performanceBuffer.shift();
        }
    }

    updateSuccessRate(success) {
        const recentResults = this.performanceBuffer.slice(-20); // 20 derniers résultats
        if (recentResults.length > 0) {
            const successCount = recentResults.filter(r => r.success).length;
            this.metrics.success_rate = Math.round((successCount / recentResults.length) * 100);
        }
    }

    startPolling() {
        // Skip polling in Node.js test environment or if already started
        if (typeof window === 'undefined' || this.timersStarted) {
            return;
        }
        this.timersStarted = true;
        
        // Polling fallback pour les environnements sans WebSocket
        this.pollingInterval = setInterval(async () => {
            try {
                // Skip API calls in Node.js test environment
                if (typeof window === 'undefined') {
                    this.updateMetrics({
                        queue_size: Math.floor(Math.random() * 10),
                        response_time: Math.floor(Math.random() * 100) + 50
                    });
                    return;
                }
                
                const response = await fetch('/api/health');
                if (response.ok) {
                    const data = await response.json();
                    this.updateMetrics({
                        queue_size: data.system?.uptime_seconds || 0,
                        response_time: Date.now() - this.lastRequestTime || 0
                    });
                }
            } catch (error) {
                console.warn('Polling update failed:', error);
            }
        }, 5000); // Poll every 5 seconds
    }

    setupPerformanceTracking() {
        // Intercepter les requêtes fetch pour mesurer les performances
        if (typeof window !== 'undefined' && window.fetch) {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const startTime = Date.now();
                try {
                    const response = await originalFetch(...args);
                    const endTime = Date.now();
                    
                    // Enregistrer la performance si c'est une API call
                    if (args[0] && args[0].includes('/api/')) {
                        this.recordApiPerformance(args[0], endTime - startTime, response.ok);
                    }
                    
                    return response;
                } catch (error) {
                    const endTime = Date.now();
                    this.recordApiPerformance(args[0], endTime - startTime, false);
                    throw error;
                }
            };
        }
    }

    recordApiPerformance(url, responseTime, success) {
        this.addToPerformanceBuffer({
            url: url,
            response_time: responseTime,
            success: success,
            timestamp: Date.now()
        });

        // Calculer la moyenne des temps de réponse
        const recentTimes = this.performanceBuffer
            .filter(r => r.response_time)
            .slice(-10)
            .map(r => r.response_time);
        
        if (recentTimes.length > 0) {
            this.metrics.response_time = Math.round(
                recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
            );
        }
    }

    startMetricsCollection() {
        // Skip metrics collection in Node.js test environment or if already started
        if (typeof window === 'undefined' || this.timersStarted) {
            console.log('📊 Metrics collection skipped in Node.js environment');
            return;
        }
        this.timersStarted = true;
        
        // Collecte périodique des métriques système
        this.metricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 10000); // Toutes les 10 secondes
    }

    async collectSystemMetrics() {
        try {
            // Skip API calls in Node.js test environment
            if (typeof window === 'undefined') {
                this.updateMetrics({
                    queue_size: Math.floor(Math.random() * 5),
                    uptime: Math.floor(Date.now() / 1000)
                });
                return;
            }
            
            const response = await fetch('/api/health');
            if (response.ok) {
                const healthData = await response.json();
                
                this.updateMetrics({
                    queue_size: healthData.system?.queue_size || 0,
                    uptime: healthData.system?.uptime_seconds || 0
                });
            }
        } catch (error) {
            console.warn('System metrics collection failed:', error);
        }
    }

    showPriorityNotification(opportunity) {
        if (typeof window !== 'undefined' && window.Notification) {
            // Notification système si permissions accordées
            if (Notification.permission === 'granted') {
                new Notification('🎯 Opportunité Prioritaire!', {
                    body: `${opportunity.title} - Valeur: ${opportunity.value}€`,
                    icon: '/favicon.ico',
                    tag: 'priority-opportunity'
                });
            }
        }
    }

    handleAutoOptimization(alert) {
        // Optimisations automatiques selon les alertes
        switch (alert.type) {
            case 'high_response_time':
                this.emit('auto_optimization', {
                    action: 'reduce_request_frequency',
                    reason: 'High response time detected'
                });
                break;
            case 'high_error_rate':
                this.emit('auto_optimization', {
                    action: 'enable_retry_backoff',
                    reason: 'High error rate detected'
                });
                break;
        }
    }

    updateUI(metrics, trends) {
        // Mise à jour de l'interface utilisateur si les éléments existent
        const elements = {
            'participations-count': metrics.participations,
            'success-rate': `${metrics.success_rate}%`,
            'queue-size': metrics.queue_size,
            'response-time': `${metrics.response_time}ms`,
            'opportunities-count': metrics.opportunities_found
        };

        Object.entries(elements).forEach(([id, value]) => {
            if (typeof document === 'undefined') {
                // Node.js environment - log instead of updating DOM
                console.log(`📊 UI Update: ${id} = ${value}`);
                return;
            }
            
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                
                // Ajouter des indicateurs de tendance
                if (trends && trends[id.replace('-count', '').replace('-', '_')]) {
                    const trend = trends[id.replace('-count', '').replace('-', '_')];
                    element.className = `metric-value trend-${trend.direction}`;
                }
            }
        });

        // Mise à jour des graphiques si ChartJS est disponible
        if (typeof window !== 'undefined' && window.Chart) {
            this.updateCharts(metrics);
        }
    }

    updateCharts(metrics) {
        // Mise à jour des graphiques en temps réel
        this.emit('chart_update', metrics);
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached, falling back to polling');
            this.startPolling();
        }
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // API publique
    getMetrics() {
        return { ...this.metrics };
    }

    getPerformanceBuffer() {
        return [...this.performanceBuffer];
    }

    isConnectedToRealTime() {
        return this.isConnected;
    }

    forceMetricsUpdate() {
        this.collectSystemMetrics();
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeMonitor;
}

// Instance globale pour usage direct
if (typeof window !== 'undefined') {
    window.RealTimeMonitor = RealTimeMonitor;
}