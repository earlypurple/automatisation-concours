// tests/integration_test.js

const AutoParticipation = require('../js/autoParticipation.js');
const Analytics = require('../js/analytics.js');
const NotificationManager = require('../js/notifications.js');
const EmailReportManager = require('../js/emailReports.js');

async function runIntegrationTest() {
    console.log('🚀 Démarrage des tests d\'intégration...\n');

    // Initialisation des composants
    const auto = new AutoParticipationManager();
    const analytics = new Analytics();
    const notifications = new NotificationManager();
    const emailReports = new EmailReportManager();

    try {
        // Test 1: Simulation d'une journée complète
        console.log('Test 1: Simulation d\'une journée complète');
        
        // Configuration de l'auto-participation
        auto.updateConfig({
            maxParticipationsPerDay: 10,
            delayBetween: 1000, // 1 seconde pour le test
            safeMode: true
        });

        // Démarrage de l'auto-participation
        await auto.start();
        console.log('✅ Auto-participation démarrée');

        // Attente et vérification des participations
        await new Promise(resolve => setTimeout(resolve, 5000));
        const stats = auto.getStats();
        console.log(`✅ ${stats.participationsToday} participations effectuées`);

        // Test 2: Vérification des analytics
        console.log('\nTest 2: Vérification des analytics');
        const analyticsStats = analytics.getStats();
        console.log(`✅ Statistiques générées : ${analyticsStats.total.participations} participations totales`);

        // Test 3: Envoi de notifications
        console.log('\nTest 3: Test des notifications');
        await notifications.showNotification('Test Réussi', {
            body: 'Notification de test',
            type: 'success'
        });
        console.log('✅ Notification envoyée');

        // Test 4: Génération de rapport
        console.log('\nTest 4: Génération de rapport email');
        const report = await emailReports.generateReport();
        console.log('✅ Rapport généré');

        // Test 5: Test de charge
        console.log('\nTest 5: Test de charge');
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(auto.processNextOpportunity());
        }
        await Promise.all(promises);
        console.log('✅ Test de charge réussi');

        // Nettoyage
        auto.stop();
        console.log('\n✨ Tests d\'intégration terminés avec succès!');

    } catch (error) {
        console.error('❌ Erreur pendant les tests:', error);
        process.exit(1);
    }
}

// Exécution des tests
runIntegrationTest();
