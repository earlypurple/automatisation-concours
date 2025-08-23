document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const toast = document.getElementById('toast');

    const settings = {
        userName: document.getElementById('userName'),
        userEmail: document.getElementById('userEmail'),
        desktopNotifications: document.getElementById('desktopNotifications'),
        browserNotifications: document.getElementById('browserNotifications'),
        minPriority: document.getElementById('minPriority'),
        scrapingInterval: document.getElementById('scrapingInterval'),
        autoParticipationEnabled: document.getElementById('autoParticipationEnabled'),
        maxPerDay: document.getElementById('maxPerDay'),
    };

    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();

            // User Data
            settings.userName.value = data.userData.name;
            settings.userEmail.value = data.userData.email;

            // Config Data
            settings.desktopNotifications.checked = data.config.notifications.desktop;
            settings.browserNotifications.checked = data.config.notifications.browser;
            settings.minPriority.value = data.config.notifications.min_priority;
            settings.scrapingInterval.value = data.config.scraping.interval_minutes;
            settings.autoParticipationEnabled.checked = data.config.auto__participation.enabled;
            settings.maxPerDay.value = data.config.auto__participation.max_per_day;

        } catch (error) {
            console.error('Erreur lors du chargement des paramètres:', error);
            showToast('Erreur lors du chargement des paramètres.', 'error');
        }
    }

    async function saveSettings() {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userData: {
                        name: settings.userName.value,
                        email: settings.userEmail.value,
                    },
                    config: {
                        notifications: {
                            desktop: settings.desktopNotifications.checked,
                            browser: settings.browserNotifications.checked,
                            min_priority: parseInt(settings.minPriority.value),
                        },
                        scraping: {
                            interval_minutes: parseInt(settings.scrapingInterval.value),
                        },
                        auto__participation: {
                            enabled: settings.autoParticipationEnabled.checked,
                            max_per_day: parseInt(settings.maxPerDay.value),
                        },
                    },
                }),
            });

            if (response.ok) {
                showToast('Paramètres enregistrés avec succès!');
            } else {
                showToast('Erreur lors de l\'enregistrement des paramètres.', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des paramètres:', error);
            showToast('Erreur lors de l\'enregistrement des paramètres.', 'error');
        }
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
        }, 3000);
    }

    saveBtn.addEventListener('click', saveSettings);

    loadSettings();
});
