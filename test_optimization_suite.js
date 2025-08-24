#!/usr/bin/env node
// test_optimization_suite.js - Tests complets de la suite d'optimisation

const { performance } = require('perf_hooks');

// Mock du localStorage pour Node.js
global.localStorage = {
    data: {},
    setItem(key, value) { this.data[key] = value; },
    getItem(key) { return this.data[key] || null; },
    removeItem(key) { delete this.data[key]; }
};

// Mock de WebSocket pour les tests
global.WebSocket = class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 10);
    }
    
    send(data) {
        // Simuler une réponse
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({
                    data: JSON.stringify({
                        type: 'metrics_update',
                        payload: { participations: 5, success_rate: 0.8 }
                    })
                });
            }
        }, 50);
    }
    
    close() {
        if (this.onclose) this.onclose();
    }
};

// Mock des modules window pour Node.js
global.window = {
    localStorage: global.localStorage,
    WebSocket: global.WebSocket,
    location: { protocol: 'http:', host: 'localhost:8080' },
    Notification: class MockNotification {
        constructor(title, options) {
            console.log(`📱 Notification: ${title} - ${options.body}`);
        }
        static requestPermission() { return Promise.resolve('granted'); }
    },
    document: {
        readyState: 'complete',
        getElementById: () => ({ textContent: '', className: '' }),
        addEventListener: () => {}
    }
};

// Charger les modules
const SmartCache = require('./js/smartCache.js');
const RealTimeMonitor = require('./js/realTimeMonitor.js');
const AIOptimizer = require('./js/aiOptimizer.js');
const GamificationEngine = require('./js/gamification.js');
const ABTestingEngine = require('./js/abTesting.js');
const ModernOptimizationSuite = require('./js/modernOptimizationSuite.js');

console.log('🧪 Démarrage des tests de la suite d\'optimisation moderne\n');

async function runTests() {
    const results = {
        passed: 0,
        failed: 0,
        total: 0
    };
    
    const tests = [
        testSmartCache,
        testRealTimeMonitor,
        testAIOptimizer,
        testGamificationEngine,
        testABTesting,
        testOptimizationSuite,
        testIntegration
    ];
    
    for (const test of tests) {
        results.total++;
        try {
            console.log(`🔬 Exécution: ${test.name}`);
            await test();
            results.passed++;
            console.log(`✅ ${test.name} - PASSÉ\n`);
        } catch (error) {
            results.failed++;
            console.error(`❌ ${test.name} - ÉCHEC:`, error.message);
            console.error(`   Stack: ${error.stack}\n`);
        }
    }
    
    // Résumé des tests
    console.log('📊 Résultats des tests:');
    console.log(`├─ Total: ${results.total}`);
    console.log(`├─ Passés: ${results.passed}`);
    console.log(`├─ Échoués: ${results.failed}`);
    console.log(`└─ Taux de réussite: ${(results.passed / results.total * 100).toFixed(1)}%`);
    
    if (results.failed === 0) {
        console.log('\n🎉 Tous les tests sont passés! La suite d\'optimisation est prête.');
    } else {
        console.log('\n⚠️ Certains tests ont échoué. Vérifiez les modules concernés.');
    }
    
    return results;
}

async function testSmartCache() {
    const cache = new SmartCache();
    await cache.init();
    
    // Test de base
    await cache.set('test_key', { data: 'test_value' }, 1000);
    const result = await cache.get('test_key');
    
    if (!result || result.data !== 'test_value') {
        throw new Error('Cache set/get failed');
    }
    
    // Test de compression
    const largeData = 'x'.repeat(2000); // > compression threshold
    await cache.set('large_key', largeData, 1000);
    const largeResult = await cache.get('large_key');
    
    if (largeResult !== largeData) {
        throw new Error('Cache compression/decompression failed');
    }
    
    // Test des statistiques
    const stats = cache.getStats();
    if (!stats.hitRate || !stats.memoryItems) {
        throw new Error('Cache stats not properly generated');
    }
    
    console.log(`   📈 Cache stats: ${stats.hitRate} hit rate, ${stats.memoryItems} items`);
}

async function testRealTimeMonitor() {
    const monitor = new RealTimeMonitor();
    monitor.init();
    
    // Test de mise à jour des métriques
    const initialMetrics = monitor.getMetrics();
    
    monitor.updateMetrics({
        participations: 10,
        success_rate: 85,
        opportunities_found: 5
    });
    
    const updatedMetrics = monitor.getMetrics();
    
    if (updatedMetrics.participations !== 10 || updatedMetrics.success_rate !== 85) {
        throw new Error('Real-time metrics update failed');
    }
    
    // Test de buffer de performance
    monitor.addToPerformanceBuffer({
        url: '/api/test',
        response_time: 250,
        success: true,
        timestamp: Date.now()
    });
    
    const buffer = monitor.getPerformanceBuffer();
    if (buffer.length === 0) {
        throw new Error('Performance buffer not working');
    }
    
    console.log(`   📊 Monitor: ${updatedMetrics.participations} participations, ${updatedMetrics.success_rate}% success`);
}

async function testAIOptimizer() {
    const aiOptimizer = new AIOptimizer();
    
    // Test d'optimisation d'opportunités
    const mockOpportunities = [
        {
            id: 'opp1',
            title: 'Test Opportunity 1',
            value: 50,
            type: 'echantillons',
            priority: 5,
            site: 'test_site',
            expires_at: new Date(Date.now() + 86400000).toISOString()
        },
        {
            id: 'opp2', 
            title: 'Test Opportunity 2',
            value: 100,
            type: 'concours',
            priority: 7,
            site: 'test_site',
            expires_at: new Date(Date.now() + 172800000).toISOString()
        }
    ];
    
    const optimized = await aiOptimizer.optimizeOpportunities(mockOpportunities);
    
    if (!optimized || optimized.length !== 2) {
        throw new Error('AI optimization failed');
    }
    
    const firstOpp = optimized[0];
    if (!firstOpp.ai_score || !firstOpp.ai_predictions) {
        throw new Error('AI enhancement missing');
    }
    
    // Test d'apprentissage
    await aiOptimizer.learnFromResult(firstOpp, {
        success: true,
        value_obtained: 50,
        time_taken: 1500
    });
    
    const stats = aiOptimizer.getStats();
    if (stats.learning_sessions < 1) {
        throw new Error('AI learning not working');
    }
    
    console.log(`   🧠 AI: ${stats.predictions_made} predictions, ${stats.accuracy} accuracy`);
}

async function testGamificationEngine() {
    const gamification = new GamificationEngine();
    
    // Test de simulation de participation
    const playerInfo = gamification.simulateParticipation(true, 50);
    
    if (playerInfo.level < 1 || playerInfo.xp <= 0) {
        throw new Error('Gamification simulation failed');
    }
    
    // Test de badges
    const badges = gamification.getAvailableBadges();
    if (!badges || badges.length === 0) {
        throw new Error('Badges system not working');
    }
    
    // Test d'achievements
    const achievements = gamification.getAchievements();
    if (!achievements || achievements.length === 0) {
        throw new Error('Achievements system not working');
    }
    
    // Test d'objectifs quotidiens
    const dailyGoals = gamification.getDailyGoals();
    if (!dailyGoals || dailyGoals.length === 0) {
        throw new Error('Daily goals system not working');
    }
    
    console.log(`   🎮 Gamification: Level ${playerInfo.level}, ${playerInfo.xp} XP, ${playerInfo.coins} coins`);
}

async function testABTesting() {
    const abTesting = new ABTestingEngine();
    
    // Test de création de test
    const test = abTesting.createTest('notification_style');
    
    if (!test || !test.id) {
        throw new Error('A/B test creation failed');
    }
    
    // Test d'assignation d'utilisateur
    const variant = abTesting.assignUserToVariant('test_user_1', test.id);
    
    if (!variant || !variant.id) {
        throw new Error('User variant assignment failed');
    }
    
    // Test d'enregistrement d'événement
    abTesting.recordEvent('test_user_1', test.id, 'participation', {
        opportunity_id: 'test_opp'
    });
    
    abTesting.recordEvent('test_user_1', test.id, 'success', {
        value: 25
    });
    
    // Simuler des données pour test
    abTesting.simulateTestData(test.id, 50);
    
    const activeTests = abTesting.getActiveTests();
    if (activeTests.length === 0) {
        throw new Error('Active tests not properly managed');
    }
    
    console.log(`   🧪 A/B Testing: ${activeTests.length} active tests, ${test.variants.length} variants`);
}

async function testOptimizationSuite() {
    // Attendre l'initialisation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const suite = new ModernOptimizationSuite();
    
    // Attendre l'initialisation complète
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!suite.initialized) {
        throw new Error('Optimization suite initialization failed');
    }
    
    // Test du statut système
    const status = suite.getSystemStatus();
    
    if (!status.version || !status.metrics) {
        throw new Error('System status not properly generated');
    }
    
    // Test des statistiques des modules
    const moduleStats = suite.getModuleStats();
    
    if (Object.keys(moduleStats).length === 0) {
        throw new Error('Module stats not available');
    }
    
    // Test d'optimisation manuelle
    const optimizationResults = await suite.triggerOptimization('cache');
    
    if (!optimizationResults || typeof optimizationResults.improved === 'undefined') {
        throw new Error('Manual optimization failed');
    }
    
    console.log(`   🚀 Suite: v${status.version}, ${status.metrics.modules_loaded} modules, ${status.metrics.startup_time.toFixed(2)}ms startup`);
}

async function testIntegration() {
    // Test d'intégration entre les modules
    if (!global.window.modernOptimizationSuite) {
        throw new Error('Global optimization suite not available');
    }
    
    const suite = global.window.modernOptimizationSuite;
    
    // Vérifier que les modules sont bien intégrés
    const activeModules = Object.values(suite.modules).filter(m => m !== null);
    
    if (activeModules.length < 2) {
        throw new Error('Insufficient module integration');
    }
    
    // Test d'événement inter-modules
    let eventReceived = false;
    
    if (suite.eventBus) {
        suite.eventBus.on('test_event', () => {
            eventReceived = true;
        });
        
        suite.eventBus.emit('test_event', { test: true });
        
        // Attendre que l'événement soit traité
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!eventReceived) {
            throw new Error('Inter-module event system not working');
        }
    }
    
    console.log(`   🔗 Integration: ${activeModules.length} modules integrated successfully`);
}

// Exécuter les tests
runTests().catch(error => {
    console.error('🚨 Erreur fatale lors des tests:', error);
    process.exit(1);
});