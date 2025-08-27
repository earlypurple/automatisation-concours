// gamification.js
// Système de gamification pour augmenter l'engagement utilisateur

class GamificationEngine {
    constructor() {
        this.player = {
            level: 1,
            xp: 0,
            coins: 0,
            streak: 0,
            badges: [],
            achievements: [],
            stats: {
                total_participations: 0,
                successful_participations: 0,
                total_value_won: 0,
                days_active: 0,
                perfect_days: 0,
                categories_mastered: []
            }
        };
        
        this.levels = this.generateLevelSystem();
        this.badges = this.initializeBadges();
        this.achievements = this.initializeAchievements();
        this.dailyGoals = this.generateDailyGoals();
        this.leaderboard = [];
        
        this.notifications = new GamificationNotifications();
        this.rewards = new RewardSystem();
        this.challenges = new ChallengeSystem();
        
        this.init();
        this.dailyResetTimeout = null;
        this.dailyResetInterval = null;
    }

    init() {
        this.loadPlayerData();
        this.updateDailyGoals();
        this.checkAchievements();
        this.startDailyReset();
        
        console.log('🎮 Gamification Engine initialized');
        console.log(`👤 Player Level ${this.player.level} | XP: ${this.player.xp} | Coins: ${this.player.coins}`);
    }

    destroy() {
        if (this.dailyResetTimeout) {
            clearTimeout(this.dailyResetTimeout);
        }
        if (this.dailyResetInterval) {
            clearInterval(this.dailyResetInterval);
        }
    }

    // === SYSTÈME DE NIVEAUX ET EXPÉRIENCE ===
    
    generateLevelSystem() {
        const levels = [];
        for (let i = 1; i <= 100; i++) {
            levels.push({
                level: i,
                xp_required: Math.floor(100 * Math.pow(1.15, i - 1)),
                title: this.getLevelTitle(i),
                rewards: this.getLevelRewards(i),
                unlocks: this.getLevelUnlocks(i)
            });
        }
        return levels;
    }

    getLevelTitle(level) {
        if (level < 5) return "Novice Chasseur";
        if (level < 10) return "Apprenti Collecteur";
        if (level < 20) return "Expert Opportuniste";
        if (level < 35) return "Maître Concouriste";
        if (level < 50) return "Champion des Échantillons";
        if (level < 75) return "Légende Vivante";
        return "Grand Maître Ultime";
    }

    getLevelRewards(level) {
        const rewards = [];
        
        if (level % 5 === 0) {
            rewards.push({ type: 'coins', amount: level * 10 });
        }
        
        if (level % 10 === 0) {
            rewards.push({ type: 'badge', id: `level_${level}` });
        }
        
        if ([25, 50, 75, 100].includes(level)) {
            rewards.push({ type: 'special_power', id: `power_${level}` });
        }
        
        return rewards;
    }

    getLevelUnlocks(level) {
        const unlocks = [];
        
        if (level === 5) unlocks.push("Système de prédictions avancées");
        if (level === 10) unlocks.push("Mode automatique intelligent");
        if (level === 15) unlocks.push("Notifications personnalisées");
        if (level === 20) unlocks.push("Défis quotidiens");
        if (level === 25) unlocks.push("Multiplicateur de gains");
        if (level === 30) unlocks.push("Prédiction de timing optimal");
        if (level === 50) unlocks.push("Mode expert avec IA");
        
        return unlocks;
    }

    // === SYSTÈME DE BADGES ===
    
    initializeBadges() {
        return {
            // Badges de participation
            first_participation: {
                name: "Premier Pas",
                description: "Première participation réussie",
                icon: "🎯",
                rarity: "common",
                xp_reward: 50
            },
            
            participation_streak_7: {
                name: "Semaine Parfaite",
                description: "7 jours consécutifs de participation",
                icon: "🔥",
                rarity: "uncommon",
                xp_reward: 200
            },
            
            participation_streak_30: {
                name: "Mois Légendaire",
                description: "30 jours consécutifs de participation",
                icon: "👑",
                rarity: "legendary",
                xp_reward: 1000
            },
            
            // Badges de valeur
            value_hunter_100: {
                name: "Chasseur de Valeur",
                description: "Gagner plus de 100€ de valeur",
                icon: "💰",
                rarity: "rare",
                xp_reward: 300
            },
            
            value_hunter_500: {
                name: "Collectionneur Premium",
                description: "Gagner plus de 500€ de valeur",
                icon: "💎",
                rarity: "epic",
                xp_reward: 750
            },
            
            // Badges de performance
            perfectionist: {
                name: "Perfectionniste",
                description: "100% de taux de succès sur 20 participations",
                icon: "⭐",
                rarity: "epic",
                xp_reward: 500
            },
            
            speed_demon: {
                name: "Démon de Vitesse",
                description: "Participer à 10 concours en 1 heure",
                icon: "⚡",
                rarity: "rare",
                xp_reward: 250
            },
            
            // Badges spéciaux
            category_master_beauty: {
                name: "Maître Beauté",
                description: "Expert en produits de beauté",
                icon: "💄",
                rarity: "rare",
                xp_reward: 200
            },
            
            early_bird: {
                name: "Lève-Tôt",
                description: "Participer avant 8h du matin",
                icon: "🌅",
                rarity: "uncommon",
                xp_reward: 100
            },
            
            night_owl: {
                name: "Oiseau de Nuit",
                description: "Participer après 22h",
                icon: "🦉",
                rarity: "uncommon",
                xp_reward: 100
            }
        };
    }

    // === SYSTÈME D'ACHIEVEMENTS ===
    
    initializeAchievements() {
        return [
            {
                id: "first_win",
                name: "Première Victoire",
                description: "Remporter votre premier concours",
                progress_max: 1,
                reward: { type: "coins", amount: 100 },
                unlocked: false
            },
            
            {
                id: "participation_master",
                name: "Maître de la Participation",
                description: "Participer à 1000 concours",
                progress_max: 1000,
                reward: { type: "badge", id: "participation_master" },
                unlocked: false
            },
            
            {
                id: "value_collector",
                name: "Collectionneur de Valeur",
                description: "Accumuler 1000€ de gains totaux",
                progress_max: 1000,
                reward: { type: "special_power", id: "value_multiplier" },
                unlocked: false
            },
            
            {
                id: "streak_legend",
                name: "Légende des Séries",
                description: "Maintenir une série de 100 jours",
                progress_max: 100,
                reward: { type: "title", id: "streak_legend" },
                unlocked: false
            },
            
            {
                id: "category_explorer",
                name: "Explorateur de Catégories",
                description: "Participer dans toutes les catégories",
                progress_max: 6, // Nombre de catégories
                reward: { type: "coins", amount: 500 },
                unlocked: false
            }
        ];
    }

    // === ÉVÉNEMENTS ET POINTS ===
    
    onParticipation(opportunity, result) {
        const points = this.calculateParticipationPoints(opportunity, result);
        
        this.addExperience(points.xp);
        this.addCoins(points.coins);
        this.updateStreak(result.success);
        this.updateStats(opportunity, result);
        
        // Vérifier les badges et achievements
        this.checkBadges(opportunity, result);
        this.checkAchievements();
        
        // Notifications de gain
        this.notifications.showParticipationReward(points, result.success);
        
        // Mise à jour des défis
        this.challenges.updateProgress('participate', 1);
        
        console.log(`🎮 +${points.xp} XP, +${points.coins} coins for participation`);
    }

    calculateParticipationPoints(opportunity, result) {
        let baseXP = 10;
        let baseCoins = 5;
        
        // Bonus pour succès
        if (result.success) {
            baseXP += 20;
            baseCoins += 10;
        }
        
        // Bonus selon la valeur
        if (opportunity.value > 50) {
            baseXP += 10;
            baseCoins += 5;
        }
        
        // Bonus selon la priorité
        baseXP += opportunity.priority * 2;
        
        // Multiplicateur de série
        if (this.player.streak > 7) {
            baseXP = Math.floor(baseXP * 1.2);
        }
        
        if (this.player.streak > 30) {
            baseXP = Math.floor(baseXP * 1.5);
        }
        
        // Multiplicateurs spéciaux (débloqés avec les niveaux)
        if (this.hasSpecialPower('xp_multiplier')) {
            baseXP = Math.floor(baseXP * 1.3);
        }
        
        return { xp: baseXP, coins: baseCoins };
    }

    addExperience(xp) {
        const oldLevel = this.player.level;
        this.player.xp += xp;
        
        // Vérifier les montées de niveau
        while (this.canLevelUp()) {
            this.levelUp();
        }
        
        if (this.player.level > oldLevel) {
            this.notifications.showLevelUp(this.player.level, oldLevel);
        }
        
        this.savePlayerData();
    }

    canLevelUp() {
        const currentLevelData = this.levels[this.player.level - 1];
        return currentLevelData && this.player.xp >= currentLevelData.xp_required;
    }

    levelUp() {
        this.player.level++;
        const levelData = this.levels[this.player.level - 1];
        
        if (levelData && levelData.rewards) {
            levelData.rewards.forEach(reward => {
                this.giveReward(reward);
            });
        }
        
        console.log(`🎉 Level UP! Vous êtes maintenant niveau ${this.player.level}: ${levelData?.title}`);
    }

    addCoins(coins) {
        this.player.coins += coins;
        this.savePlayerData();
    }

    updateStreak(success) {
        if (success) {
            this.player.streak++;
            
            // Badges de série
            if (this.player.streak === 7) {
                this.unlockBadge('participation_streak_7');
            } else if (this.player.streak === 30) {
                this.unlockBadge('participation_streak_30');
            }
        } else {
            this.player.streak = 0;
        }
        
        this.savePlayerData();
    }

    updateStats(opportunity, result) {
        this.player.stats.total_participations++;
        
        if (result.success) {
            this.player.stats.successful_participations++;
            this.player.stats.total_value_won += result.value_obtained || opportunity.value || 0;
        }
        
        // Mise à jour des catégories maîtrisées
        if (!this.player.stats.categories_mastered.includes(opportunity.type)) {
            const categoryCount = this.getCategoryParticipationCount(opportunity.type);
            if (categoryCount >= 50) { // Maîtrise après 50 participations
                this.player.stats.categories_mastered.push(opportunity.type);
                this.unlockBadge(`category_master_${opportunity.type}`);
            }
        }
    }

    // === SYSTÈME DE BADGES ===
    
    checkBadges(opportunity, result) {
        // Badge première participation
        if (this.player.stats.total_participations === 1 && result.success) {
            this.unlockBadge('first_participation');
        }
        
        // Badges de valeur
        if (this.player.stats.total_value_won >= 100 && !this.hasBadge('value_hunter_100')) {
            this.unlockBadge('value_hunter_100');
        }
        
        if (this.player.stats.total_value_won >= 500 && !this.hasBadge('value_hunter_500')) {
            this.unlockBadge('value_hunter_500');
        }
        
        // Badge perfectionniste
        if (this.checkPerfectionistBadge()) {
            this.unlockBadge('perfectionist');
        }
        
        // Badges temporels
        const hour = new Date().getHours();
        if (hour < 8 && !this.hasBadge('early_bird')) {
            this.unlockBadge('early_bird');
        } else if (hour >= 22 && !this.hasBadge('night_owl')) {
            this.unlockBadge('night_owl');
        }
    }

    unlockBadge(badgeId) {
        if (this.hasBadge(badgeId)) return;
        
        const badge = this.badges[badgeId];
        if (!badge) return;
        
        this.player.badges.push(badgeId);
        this.addExperience(badge.xp_reward);
        
        this.notifications.showBadgeUnlocked(badge);
        
        console.log(`🏆 Badge débloqué: ${badge.name} (+${badge.xp_reward} XP)`);
    }

    hasBadge(badgeId) {
        return this.player.badges.includes(badgeId);
    }

    checkPerfectionistBadge() {
        const recentParticipations = this.getRecentParticipations(20);
        return recentParticipations.length === 20 && 
               recentParticipations.every(p => p.success);
    }

    // === SYSTÈME D'ACHIEVEMENTS ===
    
    checkAchievements() {
        this.achievements.forEach(achievement => {
            if (achievement.unlocked) return;
            
            const progress = this.getAchievementProgress(achievement.id);
            
            if (progress >= achievement.progress_max) {
                this.unlockAchievement(achievement);
            }
        });
    }

    getAchievementProgress(achievementId) {
        switch (achievementId) {
            case 'first_win':
                return this.player.stats.successful_participations > 0 ? 1 : 0;
            case 'participation_master':
                return this.player.stats.total_participations;
            case 'value_collector':
                return this.player.stats.total_value_won;
            case 'streak_legend':
                return this.player.streak;
            case 'category_explorer':
                return this.player.stats.categories_mastered.length;
            default:
                return 0;
        }
    }

    unlockAchievement(achievement) {
        achievement.unlocked = true;
        this.giveReward(achievement.reward);
        this.notifications.showAchievementUnlocked(achievement);
        
        console.log(`🎯 Achievement débloqué: ${achievement.name}`);
    }

    // === SYSTÈME DE DÉFIS QUOTIDIENS ===
    
    generateDailyGoals() {
        const goals = [
            {
                id: 'daily_participation',
                name: 'Participation Quotidienne',
                description: 'Participer à 5 concours aujourd\'hui',
                target: 5,
                progress: 0,
                reward: { type: 'coins', amount: 50 },
                expires: this.getTomorrowMidnight()
            },
            
            {
                id: 'daily_value',
                name: 'Chasseur de Valeur',
                description: 'Obtenir 100€ de valeur aujourd\'hui',
                target: 100,
                progress: 0,
                reward: { type: 'xp', amount: 100 },
                expires: this.getTomorrowMidnight()
            },
            
            {
                id: 'daily_success',
                name: 'Jour Parfait',
                description: 'Réussir 3 participations sans échec',
                target: 3,
                progress: 0,
                reward: { type: 'badge', id: 'perfect_day' },
                expires: this.getTomorrowMidnight()
            }
        ];
        
        return goals;
    }

    updateDailyGoals() {
        // Vérifier si les objectifs ont expiré
        const now = Date.now();
        this.dailyGoals = this.dailyGoals.filter(goal => goal.expires > now);
        
        // Générer de nouveaux objectifs si nécessaire
        if (this.dailyGoals.length === 0) {
            this.dailyGoals = this.generateDailyGoals();
        }
    }

    getTomorrowMidnight() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }

    // === SYSTÈME DE RÉCOMPENSES ===
    
    giveReward(reward) {
        switch (reward.type) {
            case 'xp':
                this.addExperience(reward.amount);
                break;
            case 'coins':
                this.addCoins(reward.amount);
                break;
            case 'badge':
                this.unlockBadge(reward.id);
                break;
            case 'special_power':
                this.unlockSpecialPower(reward.id);
                break;
            case 'title':
                this.unlockTitle(reward.id);
                break;
        }
    }

    unlockSpecialPower(powerId) {
        if (!this.player.special_powers) {
            this.player.special_powers = [];
        }
        
        if (!this.player.special_powers.includes(powerId)) {
            this.player.special_powers.push(powerId);
            this.notifications.showSpecialPowerUnlocked(powerId);
        }
    }

    hasSpecialPower(powerId) {
        return this.player.special_powers?.includes(powerId) || false;
    }

    // === SYSTÈME DE CLASSEMENT ===
    
    updateLeaderboard() {
        // Mise à jour du classement local
        const playerScore = this.calculatePlayerScore();
        
        // Pour un vrai classement, ceci communiquerait avec un serveur
        this.leaderboard = [
            { 
                name: "Vous", 
                level: this.player.level, 
                score: playerScore,
                badges: this.player.badges.length
            }
        ];
    }

    calculatePlayerScore() {
        return this.player.level * 1000 + 
               this.player.xp + 
               this.player.stats.successful_participations * 10 +
               this.player.badges.length * 50;
    }

    // === STOCKAGE ET PERSISTANCE ===
    
    savePlayerData() {
        try {
            localStorage.setItem('gamification_player', JSON.stringify(this.player));
        } catch (error) {
            console.warn('Failed to save player data:', error);
        }
    }

    loadPlayerData() {
        try {
            const saved = localStorage.getItem('gamification_player');
            if (saved) {
                const savedPlayer = JSON.parse(saved);
                this.player = { ...this.player, ...savedPlayer };
                console.log('💾 Player data loaded');
            }
        } catch (error) {
            console.warn('Failed to load player data:', error);
        }
    }

    startDailyReset() {
        // Reset quotidien à minuit
        const now = new Date();
        const midnight = new Date();
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        
        const timeUntilMidnight = midnight.getTime() - now.getTime();
        
        this.dailyResetTimeout = setTimeout(() => {
            this.performDailyReset();
            // Programmer le prochain reset dans 24h
            this.dailyResetInterval = setInterval(() => this.performDailyReset(), 24 * 60 * 60 * 1000);
        }, timeUntilMidnight);
    }

    performDailyReset() {
        this.updateDailyGoals();
        this.player.stats.days_active++;
        
        // Vérifier si c'était un jour parfait
        if (this.isDayPerfect()) {
            this.player.stats.perfect_days++;
            this.unlockBadge('perfect_day');
        }
        
        this.savePlayerData();
        console.log('🌅 Daily reset performed');
    }

    // === MÉTHODES UTILITAIRES ===
    
    getCategoryParticipationCount(category) {
        // Simuler le comptage des participations par catégorie
        return Math.floor(this.player.stats.total_participations / 4);
    }

    getRecentParticipations(count) {
        // Simuler les participations récentes
        return Array(Math.min(count, this.player.stats.total_participations))
            .fill()
            .map(() => ({ success: Math.random() > 0.2 }));
    }

    isDayPerfect() {
        // Vérifier si tous les objectifs quotidiens ont été accomplis
        return this.dailyGoals.every(goal => goal.progress >= goal.target);
    }

    // === API PUBLIQUE ===
    
    getPlayerInfo() {
        const currentLevel = this.levels[this.player.level - 1];
        const nextLevel = this.levels[this.player.level];
        
        return {
            ...this.player,
            current_level_info: currentLevel,
            next_level_info: nextLevel,
            xp_to_next_level: nextLevel ? nextLevel.xp_required - this.player.xp : 0,
            success_rate: this.player.stats.total_participations > 0 
                ? (this.player.stats.successful_participations / this.player.stats.total_participations * 100).toFixed(1)
                : 0,
            total_score: this.calculatePlayerScore()
        };
    }

    getDailyGoals() {
        return this.dailyGoals;
    }

    getAvailableBadges() {
        return Object.entries(this.badges).map(([id, badge]) => ({
            id,
            ...badge,
            unlocked: this.hasBadge(id)
        }));
    }

    getAchievements() {
        return this.achievements.map(achievement => ({
            ...achievement,
            current_progress: this.getAchievementProgress(achievement.id)
        }));
    }

    getLeaderboard() {
        return this.leaderboard;
    }

    // Test method for development
    simulateParticipation(success = true, value = 25) {
        const mockOpportunity = {
            title: "Test Opportunity",
            type: "echantillons",
            value: value,
            priority: 5
        };
        
        const mockResult = {
            success: success,
            value_obtained: success ? value : 0,
            time_taken: 1500
        };
        
        this.onParticipation(mockOpportunity, mockResult);
        return this.getPlayerInfo();
    }
}

// === CLASSES AUXILIAIRES ===

class GamificationNotifications {
    showParticipationReward(points, success) {
        const message = success 
            ? `🎉 Participation réussie! +${points.xp} XP, +${points.coins} coins`
            : `💪 Bien tenté! +${points.xp} XP`;
            
        this.show(message, success ? 'success' : 'info');
    }

    showLevelUp(newLevel, oldLevel) {
        this.show(`🎊 NIVEAU SUPÉRIEUR! Niveau ${newLevel}`, 'celebration');
    }

    showBadgeUnlocked(badge) {
        this.show(`🏆 Badge débloqué: ${badge.icon} ${badge.name}`, 'achievement');
    }

    showAchievementUnlocked(achievement) {
        this.show(`🎯 Achievement: ${achievement.name}`, 'achievement');
    }

    showSpecialPowerUnlocked(powerId) {
        this.show(`⚡ Pouvoir spécial débloqué: ${powerId}`, 'special');
    }

    show(message, type = 'info') {
        // Intégration avec le système de notifications existant
        if (typeof window !== 'undefined' && window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`🎮 ${message}`);
        }
    }
}

class RewardSystem {
    constructor() {
        this.shop = this.initializeShop();
    }

    initializeShop() {
        return [
            {
                id: 'xp_boost',
                name: 'Boost XP x2',
                description: 'Double les XP pendant 1 heure',
                cost: 100,
                type: 'consumable',
                duration: 3600000 // 1 heure en ms
            },
            
            {
                id: 'auto_mode_premium',
                name: 'Mode Auto Premium',
                description: 'Mode automatique avec IA avancée',
                cost: 500,
                type: 'upgrade',
                permanent: true
            },
            
            {
                id: 'notification_customization',
                name: 'Notifications Personnalisées',
                description: 'Personnaliser sons et styles',
                cost: 200,
                type: 'cosmetic',
                permanent: true
            }
        ];
    }

    purchaseItem(itemId, playerCoins) {
        const item = this.shop.find(i => i.id === itemId);
        if (!item || playerCoins < item.cost) {
            return { success: false, message: 'Coins insuffisants' };
        }

        return { 
            success: true, 
            item: item, 
            newCoins: playerCoins - item.cost 
        };
    }
}

class ChallengeSystem {
    constructor() {
        this.activeChallenges = this.generateWeeklyChallenges();
    }

    generateWeeklyChallenges() {
        return [
            {
                id: 'weekly_participation',
                name: 'Marathon Hebdomadaire',
                description: 'Participer à 50 concours cette semaine',
                target: 50,
                progress: 0,
                reward: { type: 'coins', amount: 300 },
                expires: this.getNextWeek()
            },
            
            {
                id: 'category_diversity',
                name: 'Explorateur Diversifié',
                description: 'Participer dans 5 catégories différentes',
                target: 5,
                progress: 0,
                reward: { type: 'badge', id: 'diversity_master' },
                expires: this.getNextWeek()
            }
        ];
    }

    updateProgress(action, amount) {
        this.activeChallenges.forEach(challenge => {
            if (this.challengeAppliesToAction(challenge, action)) {
                challenge.progress += amount;
            }
        });
    }

    challengeAppliesToAction(challenge, action) {
        switch (challenge.id) {
            case 'weekly_participation':
                return action === 'participate';
            case 'category_diversity':
                return action === 'new_category';
            default:
                return false;
        }
    }

    getNextWeek() {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.getTime();
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GamificationEngine;
}

// Instance globale
if (typeof window !== 'undefined') {
    window.GamificationEngine = GamificationEngine;
}