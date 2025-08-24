// Service Worker pour Progressive Web App
// Version 2.0 - Support hors-ligne amélioré et notifications push

const CACHE_NAME = 'automatisation-concours-v2.0';
const API_CACHE_NAME = 'api-cache-v1.0';

// Ressources à mettre en cache
const STATIC_RESOURCES = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/analytics.js',
    '/static/js/notifications.js',
    '/static/images/icon-192.png',
    '/static/images/icon-512.png',
    '/static/sounds/notification.mp3',
    '/static/sounds/success.mp3',
    '/static/sounds/warning.mp3',
    '/static/sounds/error.mp3'
];

// URLs API à mettre en cache temporairement
const API_URLS = [
    '/api/opportunities',
    '/api/analytics',
    '/api/profiles'
];

// Installation du service worker
self.addEventListener('install', event => {
    console.log('Service Worker: Installation');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Mise en cache des ressources statiques');
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(() => {
                console.log('Service Worker: Installation terminée');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Erreur lors de l\'installation', error);
            })
    );
});

// Activation du service worker
self.addEventListener('activate', event => {
    console.log('Service Worker: Activation');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Supprimer les anciens caches
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('Service Worker: Suppression ancien cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation terminée');
                return self.clients.claim();
            })
    );
});

// Interception des requêtes (stratégie Cache First pour les ressources statiques)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Stratégie différente selon le type de ressource
    if (isStaticResource(event.request)) {
        // Cache First pour les ressources statiques
        event.respondWith(cacheFirstStrategy(event.request));
    } else if (isAPIRequest(event.request)) {
        // Network First pour l'API avec fallback cache
        event.respondWith(networkFirstStrategy(event.request));
    } else {
        // Stratégie par défaut
        event.respondWith(
            fetch(event.request).catch(() => {
                // Page de fallback en cas d'erreur
                return caches.match('/offline.html') || 
                       new Response('Application hors-ligne', {
                           status: 200,
                           headers: { 'Content-Type': 'text/plain' }
                       });
            })
        );
    }
});

// Stratégie Cache First
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Cache First Strategy Error:', error);
        return new Response('Ressource non disponible', { status: 503 });
    }
}

// Stratégie Network First avec cache de fallback
async function networkFirstStrategy(request) {
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Mettre en cache seulement les GET requests
            if (request.method === 'GET') {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        console.log('Network failed, trying cache:', request.url);
        
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            // Ajouter un header pour indiquer que c'est du cache
            const response = cachedResponse.clone();
            response.headers.set('X-Served-By', 'ServiceWorker-Cache');
            return response;
        }
        
        // Réponse de fallback pour les APIs
        return new Response(JSON.stringify({
            error: 'Données non disponibles hors-ligne',
            cached: false,
            timestamp: new Date().toISOString()
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Vérifier si c'est une ressource statique
function isStaticResource(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/static/') || 
           STATIC_RESOURCES.includes(url.pathname);
}

// Vérifier si c'est une requête API
function isAPIRequest(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/');
}

// Gestion des notifications push
self.addEventListener('push', event => {
    console.log('Service Worker: Notification push reçue');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Notification', body: event.data.text() };
        }
    }
    
    const title = data.title || 'Automatisation Concours';
    const options = {
        body: data.body || 'Nouvelle notification',
        icon: '/static/images/icon-192.png',
        badge: '/static/images/badge-72.png',
        vibrate: [100, 50, 100],
        data: data.url ? { url: data.url } : {},
        actions: [
            { action: 'view', title: 'Voir' },
            { action: 'dismiss', title: 'Ignorer' }
        ],
        requireInteraction: data.requireInteraction || false,
        silent: false
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Clic sur notification');
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // Ouvrir l'application ou l'URL spécifiée
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Chercher une fenêtre existante
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Ouvrir une nouvelle fenêtre
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync');
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Synchroniser les données en attente
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            console.log('Background sync successful');
            
            // Notifier l'application
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'sync-complete',
                    success: true
                });
            });
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Gestion des messages de l'application
self.addEventListener('message', event => {
    console.log('Service Worker: Message reçu', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => cache.addAll(event.data.urls))
        );
    }
});

// Nettoyage périodique du cache
self.addEventListener('periodicsync', event => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupCache());
    }
});

async function cleanupCache() {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const keys = await cache.keys();
        
        // Supprimer les entrées de plus de 24h
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures
        const now = Date.now();
        
        for (const request of keys) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader) {
                const responseDate = new Date(dateHeader).getTime();
                if (now - responseDate > maxAge) {
                    await cache.delete(request);
                    console.log('Cache cleanup: Deleted old entry', request.url);
                }
            }
        }
    } catch (error) {
        console.error('Cache cleanup error:', error);
    }
}