/**
 * @file abTesting.js
 * @description An automatic A/B testing system for continuous optimization.
 */

/**
 * @class ABTestingEngine
 * @description The main class for the A/B testing engine. It allows to create, manage, and analyze A/B tests.
 */
class ABTestingEngine {
    constructor() {
        this.activeTests = new Map();
        this.completedTests = [];
        this.userSegments = new Map();
        this.testResults = new Map();
        
        this.config = {
            min_sample_size: 100,
            confidence_level: 0.95,
            test_duration: 7 * 24 * 60 * 60 * 1000, // 7 jours
            auto_winner_selection: true,
            max_concurrent_tests: 3
        };
        
        this.metrics = {
            participation_rate: 'participation_rate',
            success_rate: 'success_rate', 
            average_value: 'average_value',
            user_satisfaction: 'user_satisfaction',
            time_to_completion: 'time_to_completion'
        };
        
        this.testTemplates = this.initializeTestTemplates();
        this.statisticsEngine = new StatisticsEngine();
        
        this.init();
    }

    init() {
        this.loadActiveTests();
        this.startAutoTestGeneration();
        this.startResultsMonitoring();
        
        console.log('🧪 A/B Testing Engine initialized');
        console.log(`📊 ${this.activeTests.size} active tests, ${this.completedTests.length} completed`);
    }

    // === CRÉATION ET GESTION DES TESTS ===
    
    initializeTestTemplates() {
        return {
            // Tests d'interface utilisateur
            notification_style: {
                name: "Style de Notifications",
                description: "Tester différents styles de notifications",
                type: "ui",
                variants: [
                    { id: "classic", name: "Style Classique", config: { style: "classic", sound: true } },
                    { id: "modern", name: "Style Moderne", config: { style: "modern", animation: true } },
                    { id: "minimal", name: "Style Minimal", config: { style: "minimal", sound: false } }
                ],
                primary_metric: "user_satisfaction",
                secondary_metrics: ["participation_rate"]
            },
            
            // Tests d'algorithmes
            opportunity_sorting: {
                name: "Algorithme de Tri des Opportunités",
                description: "Optimiser l'ordre de présentation des opportunités",
                type: "algorithm",
                variants: [
                    { id: "value_first", name: "Valeur Prioritaire", config: { sort_by: "value", weight: 0.8 } },
                    { id: "success_first", name: "Succès Prioritaire", config: { sort_by: "success_rate", weight: 0.7 } },
                    { id: "ai_optimized", name: "Optimisé IA", config: { sort_by: "ai_score", ml_enabled: true } }
                ],
                primary_metric: "success_rate",
                secondary_metrics: ["average_value", "participation_rate"]
            },
            
            // Tests de timing
            participation_timing: {
                name: "Timing de Participation",
                description: "Optimiser les heures de participation automatique",
                type: "timing",
                variants: [
                    { id: "immediate", name: "Immédiat", config: { delay: 0, random_delay: false } },
                    { id: "delayed_random", name: "Délai Aléatoire", config: { delay: 300, random_delay: true } },
                    { id: "optimal_timing", name: "Timing Optimal", config: { use_ai_timing: true } }
                ],
                primary_metric: "success_rate",
                secondary_metrics: ["time_to_completion"]
            },
            
            // Tests de contenu
            ui_layout: {
                name: "Disposition Interface",
                description: "Tester différentes dispositions de l'interface",
                type: "ui",
                variants: [
                    { id: "compact", name: "Vue Compacte", config: { layout: "compact", items_per_page: 20 } },
                    { id: "detailed", name: "Vue Détaillée", config: { layout: "detailed", items_per_page: 10 } },
                    { id: "cards", name: "Vue Cartes", config: { layout: "cards", items_per_page: 12 } }
                ],
                primary_metric: "participation_rate",
                secondary_metrics: ["user_satisfaction"]
            },
            
            // Tests de stratégie
            participation_strategy: {
                name: "Stratégie de Participation",
                description: "Optimiser la stratégie de sélection des concours",
                type: "strategy",
                variants: [
                    { id: "conservative", name: "Conservateur", config: { min_success_rate: 0.7, max_risk: 0.3 } },
                    { id: "aggressive", name: "Agressif", config: { min_success_rate: 0.4, max_risk: 0.8 } },
                    { id: "balanced", name: "Équilibré", config: { min_success_rate: 0.6, max_risk: 0.5 } }
                ],
                primary_metric: "average_value",
                secondary_metrics: ["success_rate", "participation_rate"]
            }
        };
    }

    /**
     * @description Creates a new A/B test from a template.
     * @param {string} templateId - The ID of the test template to use.
     * @param {Object} customConfig - An object with custom configuration for the test.
     * @returns {Object|null} The created test object, or null if the test could not be created.
     */
    createTest(templateId, customConfig = {}) {
        const template = this.testTemplates[templateId];
        if (!template) {
            throw new Error(`Test template ${templateId} not found`);
        }

        // Vérifier les limites de tests concurrents
        if (this.activeTests.size >= this.config.max_concurrent_tests) {
            console.warn('Maximum concurrent tests reached');
            return null;
        }

        const testId = this.generateTestId();
        const test = {
            id: testId,
            template_id: templateId,
            name: template.name,
            description: template.description,
            type: template.type,
            variants: template.variants,
            primary_metric: template.primary_metric,
            secondary_metrics: template.secondary_metrics,
            
            // Configuration du test
            created_at: Date.now(),
            starts_at: Date.now(),
            ends_at: Date.now() + this.config.test_duration,
            status: 'running',
            
            // Configuration personnalisée
            config: { ...template.config, ...customConfig },
            
            // Données de suivi
            participants: new Map(),
            variant_assignments: new Map(),
            results: new Map(),
            
            // Métriques
            sample_sizes: new Map(),
            conversion_rates: new Map(),
            statistical_significance: null
        };

        // Initialiser les métriques pour chaque variante
        template.variants.forEach(variant => {
            test.results.set(variant.id, {
                participants: 0,
                conversions: 0,
                total_value: 0,
                response_times: [],
                satisfaction_scores: []
            });
        });

        this.activeTests.set(testId, test);
        this.saveTests();
        
        console.log(`🧪 Created A/B test: ${test.name} (${testId})`);
        return test;
    }

    // === ASSIGNATION ET PARTICIPATION ===
    
    /**
     * @description Assigns a user to a variant of a test.
     * @param {string} userId - The ID of the user to assign.
     * @param {string} testId - The ID of the test to assign the user to.
     * @returns {Object|null} The variant object the user was assigned to, or null if the user could not be assigned.
     */
    assignUserToVariant(userId, testId) {
        const test = this.activeTests.get(testId);
        if (!test || test.status !== 'running') {
            return null;
        }

        // Vérifier si l'utilisateur est déjà assigné
        if (test.variant_assignments.has(userId)) {
            return test.variant_assignments.get(userId);
        }

        // Assignation équilibrée entre les variantes
        const variant = this.selectVariantForUser(userId, test);
        test.variant_assignments.set(userId, variant.id);
        test.participants.set(userId, {
            variant_id: variant.id,
            assigned_at: Date.now(),
            events: []
        });

        this.saveTests();
        return variant;
    }

    selectVariantForUser(userId, test) {
        // Utiliser un hash consistant pour assurer la même variante pour le même utilisateur
        const hash = this.hashUserId(userId, test.id);
        const variantIndex = hash % test.variants.length;
        return test.variants[variantIndex];
    }

    hashUserId(userId, testId) {
        // Hash simple mais consistant
        let hash = 0;
        const str = `${userId}_${testId}`;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir en 32-bit
        }
        return Math.abs(hash);
    }

    // === COLLECTE DE DONNÉES ===
    
    recordEvent(userId, testId, eventType, eventData = {}) {
        const test = this.activeTests.get(testId);
        if (!test || test.status !== 'running') {
            return;
        }

        const participant = test.participants.get(userId);
        if (!participant) {
            return;
        }

        const event = {
            type: eventType,
            timestamp: Date.now(),
            data: eventData
        };

        participant.events.push(event);
        this.updateTestMetrics(test, participant.variant_id, event);
        
        this.saveTests();
    }

    updateTestMetrics(test, variantId, event) {
        const results = test.results.get(variantId);
        if (!results) return;

        switch (event.type) {
            case 'participation':
                results.participants++;
                break;
                
            case 'success':
                results.conversions++;
                if (event.data.value) {
                    results.total_value += event.data.value;
                }
                break;
                
            case 'completion':
                if (event.data.time) {
                    results.response_times.push(event.data.time);
                }
                break;
                
            case 'satisfaction':
                if (event.data.score) {
                    results.satisfaction_scores.push(event.data.score);
                }
                break;
        }

        // Recalculer les métriques
        this.calculateTestMetrics(test);
    }

    calculateTestMetrics(test) {
        test.variants.forEach(variant => {
            const results = test.results.get(variant.id);
            if (!results) return;

            // Calculer les taux de conversion
            const conversionRate = results.participants > 0 
                ? results.conversions / results.participants 
                : 0;
            
            test.conversion_rates.set(variant.id, conversionRate);
            test.sample_sizes.set(variant.id, results.participants);
        });

        // Calculer la significativité statistique
        if (this.hasMinimumSampleSize(test)) {
            test.statistical_significance = this.calculateStatisticalSignificance(test);
        }
    }

    // === ANALYSE STATISTIQUE ===
    
    hasMinimumSampleSize(test) {
        for (const [variantId, sampleSize] of test.sample_sizes) {
            if (sampleSize < this.config.min_sample_size) {
                return false;
            }
        }
        return test.sample_sizes.size >= 2;
    }

    calculateStatisticalSignificance(test) {
        const variants = Array.from(test.sample_sizes.keys());
        if (variants.length < 2) return null;

        const controlVariant = variants[0];
        const testVariant = variants[1];

        const controlRate = test.conversion_rates.get(controlVariant) || 0;
        const testRate = test.conversion_rates.get(testVariant) || 0;
        
        const controlSize = test.sample_sizes.get(controlVariant) || 0;
        const testSize = test.sample_sizes.get(testVariant) || 0;

        return this.statisticsEngine.calculateSignificance(
            controlRate, testRate, controlSize, testSize
        );
    }

    // === GESTION AUTOMATIQUE ===
    
    startAutoTestGeneration() {
        // Génération automatique de nouveaux tests
        setInterval(() => {
            this.generateAutomaticTests();
        }, 24 * 60 * 60 * 1000); // Tous les jours
    }

    generateAutomaticTests() {
        if (this.activeTests.size >= this.config.max_concurrent_tests) {
            return;
        }

        // Analyser les performances actuelles pour identifier les tests à créer
        const suggestedTests = this.suggestTests();
        
        suggestedTests.forEach(testSuggestion => {
            if (this.activeTests.size < this.config.max_concurrent_tests) {
                this.createTest(testSuggestion.template_id, testSuggestion.config);
            }
        });
    }

    suggestTests() {
        const suggestions = [];
        
        // Analyser les métriques actuelles pour suggérer des tests
        const currentMetrics = this.getCurrentSystemMetrics();
        
        // Si le taux de succès est faible, tester les stratégies de participation
        if (currentMetrics.success_rate < 0.6) {
            suggestions.push({
                template_id: 'participation_strategy',
                priority: 'high',
                config: { focus: 'success_optimization' }
            });
        }
        
        // Si la participation est faible, tester l'interface
        if (currentMetrics.participation_rate < 0.4) {
            suggestions.push({
                template_id: 'ui_layout',
                priority: 'medium',
                config: { focus: 'engagement' }
            });
        }
        
        // Tests de timing si les temps de réponse sont élevés
        if (currentMetrics.average_response_time > 5000) {
            suggestions.push({
                template_id: 'participation_timing',
                priority: 'medium',
                config: { focus: 'performance' }
            });
        }

        return suggestions.sort((a, b) => 
            (b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0) -
            (a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0)
        );
    }

    startResultsMonitoring() {
        // Surveillance continue des résultats
        setInterval(() => {
            this.checkTestResults();
        }, 60 * 60 * 1000); // Toutes les heures
    }

    checkTestResults() {
        this.activeTests.forEach((test, testId) => {
            // Vérifier si le test est terminé
            if (Date.now() > test.ends_at || this.shouldEndTestEarly(test)) {
                this.endTest(testId);
            }
        });
    }

    shouldEndTestEarly(test) {
        // Arrêt anticipé si significativité statistique atteinte avec confiance élevée
        if (!test.statistical_significance) return false;
        
        return test.statistical_significance.p_value < 0.01 && // Très significatif
               this.hasMinimumSampleSize(test) &&
               test.statistical_significance.effect_size > 0.2; // Effet important
    }

    /**
     * @description Ends a test, analyzes the results, and implements the winner if auto-winner selection is enabled.
     * @param {string} testId - The ID of the test to end.
     */
    endTest(testId) {
        const test = this.activeTests.get(testId);
        if (!test) return;

        test.status = 'completed';
        test.completed_at = Date.now();
        
        // Analyser les résultats finaux
        const analysis = this.analyzeTestResults(test);
        test.final_analysis = analysis;
        
        // Sélection automatique du gagnant
        if (this.config.auto_winner_selection && analysis.winner) {
            this.implementWinner(test, analysis.winner);
        }
        
        // Déplacer vers les tests complétés
        this.activeTests.delete(testId);
        this.completedTests.push(test);
        
        console.log(`✅ Test completed: ${test.name} - Winner: ${analysis.winner?.name || 'No clear winner'}`);
        
        this.saveTests();
        this.generateTestReport(test);
    }

    analyzeTestResults(test) {
        const analysis = {
            total_participants: 0,
            variant_performance: new Map(),
            winner: null,
            confidence: 0,
            recommendations: []
        };

        // Analyser chaque variante
        test.variants.forEach(variant => {
            const results = test.results.get(variant.id);
            const sampleSize = test.sample_sizes.get(variant.id) || 0;
            
            analysis.total_participants += sampleSize;
            
            const performance = {
                sample_size: sampleSize,
                conversion_rate: test.conversion_rates.get(variant.id) || 0,
                average_value: results.total_value / Math.max(results.conversions, 1),
                average_response_time: this.calculateAverage(results.response_times),
                satisfaction_score: this.calculateAverage(results.satisfaction_scores)
            };
            
            analysis.variant_performance.set(variant.id, performance);
        });

        // Déterminer le gagnant
        analysis.winner = this.determineWinner(test, analysis);
        
        // Calculer la confiance dans le résultat
        if (test.statistical_significance) {
            analysis.confidence = 1 - test.statistical_significance.p_value;
        }
        
        // Générer des recommandations
        analysis.recommendations = this.generateRecommendations(test, analysis);
        
        return analysis;
    }

    determineWinner(test, analysis) {
        let bestVariant = null;
        let bestScore = -Infinity;
        
        test.variants.forEach(variant => {
            const performance = analysis.variant_performance.get(variant.id);
            if (!performance || performance.sample_size < this.config.min_sample_size) {
                return;
            }
            
            // Score composite basé sur la métrique principale
            let score = this.calculateVariantScore(test, performance);
            
            if (score > bestScore) {
                bestScore = score;
                bestVariant = variant;
            }
        });
        
        // Vérifier la significativité statistique
        if (bestVariant && test.statistical_significance?.p_value < 0.05) {
            return bestVariant;
        }
        
        return null;
    }

    calculateVariantScore(test, performance) {
        switch (test.primary_metric) {
            case 'success_rate':
                return performance.conversion_rate * 100;
            case 'average_value':
                return performance.average_value;
            case 'participation_rate':
                return performance.conversion_rate * 100;
            case 'user_satisfaction':
                return performance.satisfaction_score;
            case 'time_to_completion':
                return -performance.average_response_time; // Négatif car moins c'est mieux
            default:
                return performance.conversion_rate * 100;
        }
    }

    implementWinner(test, winner) {
        console.log(`🏆 Implementing winner: ${winner.name} for test ${test.name}`);
        
        // Appliquer la configuration gagnante au système
        switch (test.type) {
            case 'ui':
                this.applyUIConfiguration(winner.config);
                break;
            case 'algorithm':
                this.applyAlgorithmConfiguration(winner.config);
                break;
            case 'timing':
                this.applyTimingConfiguration(winner.config);
                break;
            case 'strategy':
                this.applyStrategyConfiguration(winner.config);
                break;
        }
        
        // Enregistrer la configuration gagnante
        this.saveWinnerConfiguration(test.template_id, winner);
    }

    // === INTÉGRATION AVEC LE SYSTÈME ===
    
    getActiveVariant(userId, testType) {
        // Retourner la variante active pour un utilisateur et un type de test
        for (const [testId, test] of this.activeTests) {
            if (test.type === testType && test.status === 'running') {
                return this.assignUserToVariant(userId, testId);
            }
        }
        return null;
    }

    recordParticipation(userId, opportunity, result) {
        // Enregistrer les événements pour tous les tests actifs
        this.activeTests.forEach((test, testId) => {
            if (test.participants.has(userId)) {
                this.recordEvent(userId, testId, 'participation', {
                    opportunity_id: opportunity.id,
                    opportunity_type: opportunity.type
                });
                
                if (result.success) {
                    this.recordEvent(userId, testId, 'success', {
                        value: result.value_obtained || 0
                    });
                }
                
                this.recordEvent(userId, testId, 'completion', {
                    time: result.completion_time || 0
                });
            }
        });
    }

    // === MÉTHODES UTILITAIRES ===
    
    generateTestId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateAverage(array) {
        if (!array || array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }

    getCurrentSystemMetrics() {
        // Simuler les métriques actuelles du système
        return {
            success_rate: 0.65,
            participation_rate: 0.45,
            average_response_time: 3500,
            user_satisfaction: 7.5
        };
    }

    generateRecommendations(test, analysis) {
        const recommendations = [];
        
        if (analysis.winner) {
            recommendations.push({
                type: 'implementation',
                message: `Implémenter la variante gagnante: ${analysis.winner.name}`,
                priority: 'high'
            });
        } else {
            recommendations.push({
                type: 'extend',
                message: 'Prolonger le test pour obtenir plus de données',
                priority: 'medium'
            });
        }
        
        if (analysis.confidence < 0.8) {
            recommendations.push({
                type: 'sample_size',
                message: 'Augmenter la taille de l\'échantillon',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }

    generateTestReport(test) {
        const report = {
            test_name: test.name,
            duration: test.completed_at - test.starts_at,
            total_participants: Array.from(test.sample_sizes.values()).reduce((a, b) => a + b, 0),
            winner: test.final_analysis.winner?.name || 'No winner',
            confidence: test.final_analysis.confidence,
            statistical_significance: test.statistical_significance,
            recommendations: test.final_analysis.recommendations
        };
        
        console.log('📋 Test Report:', report);
        return report;
    }

    // === PERSISTANCE ===
    
    saveTests() {
        try {
            const data = {
                active_tests: Array.from(this.activeTests.entries()),
                completed_tests: this.completedTests.slice(-50), // Garder seulement les 50 derniers
                last_save: Date.now()
            };
            
            localStorage.setItem('ab_testing_data', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save A/B testing data:', error);
        }
    }

    loadActiveTests() {
        try {
            const data = localStorage.getItem('ab_testing_data');
            if (data) {
                const parsed = JSON.parse(data);
                
                // Restaurer les tests actifs
                this.activeTests = new Map(parsed.active_tests || []);
                this.completedTests = parsed.completed_tests || [];
                
                // Nettoyer les tests expirés
                this.cleanupExpiredTests();
                
                console.log('💾 A/B testing data loaded');
            }
        } catch (error) {
            console.warn('Failed to load A/B testing data:', error);
        }
    }

    cleanupExpiredTests() {
        const now = Date.now();
        for (const [testId, test] of this.activeTests) {
            if (now > test.ends_at) {
                this.endTest(testId);
            }
        }
    }

    // === CONFIGURATION APPLICATIONS ===
    
    applyUIConfiguration(config) {
        // Appliquer les changements d'interface
        console.log('🎨 Applying UI configuration:', config);
        // Intégration avec le système d'interface
    }

    applyAlgorithmConfiguration(config) {
        // Appliquer les changements d'algorithme
        console.log('🧠 Applying algorithm configuration:', config);
        // Intégration avec les systèmes d'IA et d'optimisation
    }

    applyTimingConfiguration(config) {
        // Appliquer les changements de timing
        console.log('⏰ Applying timing configuration:', config);
        // Intégration avec le système de participation automatique
    }

    applyStrategyConfiguration(config) {
        // Appliquer les changements de stratégie
        console.log('🎯 Applying strategy configuration:', config);
        // Intégration avec le système de sélection d'opportunités
    }

    saveWinnerConfiguration(templateId, winner) {
        try {
            const winnerConfigs = JSON.parse(localStorage.getItem('ab_winner_configs') || '{}');
            winnerConfigs[templateId] = {
                variant: winner,
                implemented_at: Date.now()
            };
            localStorage.setItem('ab_winner_configs', JSON.stringify(winnerConfigs));
        } catch (error) {
            console.warn('Failed to save winner configuration:', error);
        }
    }

    // === API PUBLIQUE ===
    
    getActiveTests() {
        return Array.from(this.activeTests.values());
    }

    getCompletedTests() {
        return this.completedTests;
    }

    getTestResults(testId) {
        const test = this.activeTests.get(testId) || 
                     this.completedTests.find(t => t.id === testId);
        
        if (!test) return null;
        
        return {
            test: test,
            analysis: test.final_analysis || this.analyzeTestResults(test)
        };
    }

    createCustomTest(name, variants, primaryMetric, config = {}) {
        const customTemplate = {
            name: name,
            description: config.description || 'Custom A/B test',
            type: config.type || 'custom',
            variants: variants,
            primary_metric: primaryMetric,
            secondary_metrics: config.secondary_metrics || []
        };
        
        const testId = this.generateTestId();
        this.testTemplates[testId] = customTemplate;
        
        return this.createTest(testId, config);
    }

    // Méthode de test pour le développement
    simulateTestData(testId, participantCount = 100) {
        const test = this.activeTests.get(testId);
        if (!test) return;
        
        // Simuler des participants
        for (let i = 0; i < participantCount; i++) {
            const userId = `sim_user_${i}`;
            const variant = this.assignUserToVariant(userId, testId);
            
            // Simuler des événements aléatoires
            this.recordEvent(userId, testId, 'participation');
            
            if (Math.random() > 0.3) { // 70% de succès
                this.recordEvent(userId, testId, 'success', {
                    value: Math.random() * 100
                });
            }
            
            this.recordEvent(userId, testId, 'completion', {
                time: Math.random() * 5000
            });
        }
        
        console.log(`🎲 Simulated ${participantCount} participants for test ${testId}`);
    }
}

// === MOTEUR STATISTIQUE ===

class StatisticsEngine {
    calculateSignificance(controlRate, testRate, controlSize, testSize) {
        // Calcul du test z pour la différence de proportions
        const pooledRate = (controlRate * controlSize + testRate * testSize) / (controlSize + testSize);
        const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/controlSize + 1/testSize));
        
        if (standardError === 0) return null;
        
        const zScore = (testRate - controlRate) / standardError;
        const pValue = this.zToPValue(Math.abs(zScore));
        
        return {
            z_score: zScore,
            p_value: pValue,
            effect_size: this.calculateEffectSize(controlRate, testRate),
            confidence_interval: this.calculateConfidenceInterval(testRate, testSize)
        };
    }
    
    zToPValue(z) {
        // Approximation simple pour convertir le z-score en p-value
        if (z > 6) return 0;
        if (z < -6) return 1;
        
        const a = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
        return 2 * (1 - a);
    }
    
    erf(x) {
        // Approximation de la fonction d'erreur
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return sign * y;
    }
    
    calculateEffectSize(controlRate, testRate) {
        // Cohen's h pour la différence de proportions
        return 2 * (Math.asin(Math.sqrt(testRate)) - Math.asin(Math.sqrt(controlRate)));
    }
    
    calculateConfidenceInterval(rate, sampleSize, confidence = 0.95) {
        const z = confidence === 0.95 ? 1.96 : 2.58; // 95% ou 99%
        const margin = z * Math.sqrt((rate * (1 - rate)) / sampleSize);
        
        return {
            lower: Math.max(0, rate - margin),
            upper: Math.min(1, rate + margin)
        };
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ABTestingEngine;
}

// Instance globale
if (typeof window !== 'undefined') {
    window.ABTestingEngine = ABTestingEngine;
}