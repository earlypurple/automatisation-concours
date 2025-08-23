// tests/performance_test.js

const AutoParticipation = require('../js/autoParticipation.js');
const Analytics = require('../js/analytics.js');

async function runPerformanceTest() {
    console.log('🚀 Démarrage des tests de performance...\n');

    const auto = new AutoParticipationManager();
    const analytics = new Analytics();
    const results = {
        participation: [],
        analytics: [],
        memory: []
    };

    try {
        // Test 1: Performance de l'auto-participation
        console.log('Test 1: Performance auto-participation');
        
        const participationTests = [10, 50, 100, 500];
        for (const count of participationTests) {
            const start = process.hrtime();
            
            const promises = Array(count).fill().map(() => 
                auto.processNextOpportunity()
            );
            await Promise.all(promises);
            
            const end = process.hrtime(start);
            const duration = (end[0] * 1000) + (end[1] / 1000000);
            
            results.participation.push({
                count,
                duration,
                avgTime: duration / count
            });
        }

        // Test 2: Performance des analytics
        console.log('\nTest 2: Performance analytics');
        
        const analyticsTests = [100, 500, 1000, 5000];
        for (const count of analyticsTests) {
            const start = process.hrtime();
            
            // Simulation de données
            const data = Array(count).fill().map((_, i) => ({
                id: i,
                value: Math.random() * 100,
                timestamp: new Date().toISOString()
            }));
            
            analytics.data.participations = data;
            analytics.getStats();
            
            const end = process.hrtime(start);
            const duration = (end[0] * 1000) + (end[1] / 1000000);
            
            results.analytics.push({
                count,
                duration,
                avgTime: duration / count
            });
        }

        // Test 3: Utilisation mémoire
        console.log('\nTest 3: Test utilisation mémoire');
        
        const memoryTests = [1000, 5000, 10000];
        for (const count of memoryTests) {
            const beforeMemory = process.memoryUsage();
            
            // Création d'objets en mémoire
            const data = Array(count).fill().map(() => ({
                id: Math.random(),
                title: 'Test Opportunity',
                description: 'Lorem ipsum dolor sit amet',
                value: Math.random() * 100,
                timestamp: new Date().toISOString(),
                metadata: {
                    source: 'test',
                    category: 'performance',
                    tags: ['test', 'performance', 'memory']
                }
            }));
            
            auto.opportunities = data;
            const afterMemory = process.memoryUsage();
            
            results.memory.push({
                count,
                heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
                heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
                avgMemoryPerItem: (afterMemory.heapUsed - beforeMemory.heapUsed) / count
            });
        }

        // Affichage des résultats
        console.log('\n📊 Résultats des tests de performance:\n');
        
        console.log('Auto-participation:');
        console.table(results.participation);
        
        console.log('\nAnalytics:');
        console.table(results.analytics);
        
        console.log('\nUtilisation mémoire:');
        console.table(results.memory);

        // Analyse des résultats
        const analysis = analyzeResults(results);
        console.log('\n📈 Analyse des performances:');
        console.log(analysis);

        console.log('\n✨ Tests de performance terminés!');

    } catch (error) {
        console.error('❌ Erreur pendant les tests:', error);
        process.exit(1);
    }
}

function analyzeResults(results) {
    const analysis = {
        participation: {
            avgTimePerOp: results.participation.reduce((acc, r) => acc + r.avgTime, 0) / results.participation.length,
            scalability: checkScalability(results.participation.map(r => ({ x: r.count, y: r.duration })))
        },
        analytics: {
            avgTimePerOp: results.analytics.reduce((acc, r) => acc + r.avgTime, 0) / results.analytics.length,
            scalability: checkScalability(results.analytics.map(r => ({ x: r.count, y: r.duration })))
        },
        memory: {
            avgMemoryPerItem: results.memory.reduce((acc, r) => acc + r.avgMemoryPerItem, 0) / results.memory.length,
            memoryScalability: checkScalability(results.memory.map(r => ({ x: r.count, y: r.heapUsed })))
        }
    };

    return {
        summary: `
Performance Summary:
- Auto-participation: ${analysis.participation.avgTimePerOp.toFixed(2)}ms par opération
  Scalabilité: ${analysis.participation.scalability}
- Analytics: ${analysis.analytics.avgTimePerOp.toFixed(2)}ms par opération
  Scalabilité: ${analysis.analytics.scalability}
- Mémoire: ${(analysis.memory.avgMemoryPerItem / 1024).toFixed(2)}KB par item
  Scalabilité mémoire: ${analysis.memory.memoryScalability}
        `,
        recommendations: generateRecommendations(analysis)
    };
}

function checkScalability(data) {
    // Calcul simple de la scalabilité basé sur la croissance des temps
    const ratios = [];
    for (let i = 1; i < data.length; i++) {
        const prevRatio = data[i].y / data[i].x;
        const currRatio = data[i-1].y / data[i-1].x;
        ratios.push(prevRatio / currRatio);
    }
    
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    
    if (avgRatio <= 1.1) return "Excellente (proche du linéaire)";
    if (avgRatio <= 1.5) return "Bonne";
    if (avgRatio <= 2.0) return "Acceptable";
    return "Nécessite optimisation";
}

function generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.participation.avgTimePerOp > 100) {
        recommendations.push("➡️ Optimiser les opérations de participation (mise en cache, traitement par lots)");
    }

    if (analysis.analytics.avgTimePerOp > 50) {
        recommendations.push("➡️ Améliorer les performances des analytics (indexation, agrégation préalable)");
    }

    if (analysis.memory.avgMemoryPerItem > 10 * 1024) { // Plus de 10KB par item
        recommendations.push("➡️ Réduire l'empreinte mémoire (nettoyage périodique, compression des données)");
    }

    return recommendations;
}

// Exécution des tests
runPerformanceTest();
