// tests/improvement_analysis.js
// Script d'analyse des améliorations possibles

const Analytics = require('../js/analytics.js');
const AutoParticipationManager = require('../js/autoParticipation.js');
const ImprovementAnalyzer = require('../js/improvementAnalyzer.js');
const Utils = require('../js/utils.js');

async function runImprovementAnalysis() {
    console.log('🔍 Démarrage de l\'analyse des améliorations...\n');

    // Initialisation des composants
    const analytics = new Analytics();
    const autoParticipation = new AutoParticipationManager();
    const analyzer = new ImprovementAnalyzer();

    // Configuration de l'analyseur
    analyzer.init(analytics, autoParticipation);

    try {
        // Analyse de l'état actuel
        console.log('📊 Analyse de l\'état actuel du système...');
        const analysis = await analyzer.analyzeCurrentState();

        // Génération du rapport
        console.log('📝 Génération du rapport d\'amélioration...');
        const report = analyzer.generateReport(analysis);

        // Affichage du rapport
        console.log('\n' + '='.repeat(80));
        console.log(report);
        console.log('='.repeat(80));

        // Sauvegarde du rapport
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `improvement-report-${timestamp}.md`;
        
        // Si on est dans un environnement avec filesystem
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                fs.writeFileSync(`/tmp/${filename}`, report);
                console.log(`\n📄 Rapport sauvegardé dans /tmp/${filename}`);
            } catch (error) {
                console.log('ℹ️ Impossible de sauvegarder le fichier (normal en environnement de test)');
            }
        }

        // Statistiques rapides
        const totalIssues = Object.values(analysis.categories)
            .reduce((total, category) => total + category.length, 0);
        
        console.log('\n📈 Résumé de l\'analyse:');
        console.log(`- ${totalIssues} améliorations identifiées`);
        console.log(`- Score de priorité: ${analysis.priorityScore}/10`);
        
        const criticalIssues = analysis.categories.critical.length;
        const performanceIssues = analysis.categories.performance.length;
        const featureIssues = analysis.categories.features.length;
        
        console.log(`- ${criticalIssues} problèmes critiques`);
        console.log(`- ${performanceIssues} améliorations de performance`);
        console.log(`- ${featureIssues} nouvelles fonctionnalités suggérées`);

        // Recommandations prioritaires
        const plan = analyzer.generateImprovementPlan(analysis);
        if (plan.phases.immediate.length > 0) {
            console.log('\n🚨 Actions immédiates recommandées:');
            plan.phases.immediate.slice(0, 3).forEach((item, index) => {
                console.log(`${index + 1}. ${item.issue} (Priorité: ${item.priority}/10)`);
            });
        }

        console.log('\n✨ Analyse des améliorations terminée!');
        return analysis;

    } catch (error) {
        console.error('❌ Erreur pendant l\'analyse:', error);
        process.exit(1);
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runImprovementAnalysis };
}

// Exécution directe si appelé comme script
if (require.main === module) {
    runImprovementAnalysis();
}