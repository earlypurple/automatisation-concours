// auth.js

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
        this.token = null;
        this.init();
    }

    init() {
        // Vérifier le token stocké
        this.token = Utils.getLocalStorage('auth_token');
        if (this.token) {
            this.validateToken();
        }
    }

    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error('Échec de connexion');
            }

            const data = await response.json();
            this.token = data.token;
            this.user = data.user;
            this.isAuthenticated = true;

            Utils.setLocalStorage('auth_token', this.token);
            Utils.setLocalStorage('user', this.user);

            return true;
        } catch (error) {
            console.error('Erreur de connexion:', error);
            return false;
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.user = null;
        this.token = null;
        Utils.removeLocalStorage('auth_token');
        Utils.removeLocalStorage('user');
        window.location.href = '/login.html';
    }

    async validateToken() {
        try {
            const response = await fetch('/api/auth/validate', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                this.logout();
                return false;
            }

            const data = await response.json();
            this.user = data.user;
            this.isAuthenticated = true;
            return true;
        } catch (error) {
            console.error('Erreur de validation:', error);
            this.logout();
            return false;
        }
    }

    isAdmin() {
        return this.user?.role === 'admin';
    }

    getUser() {
        return this.user;
    }

    updateProfile(userData) {
        // Mise à jour du profil utilisateur
    }

    async resetPassword(email) {
        // Système de réinitialisation de mot de passe
    }
}
