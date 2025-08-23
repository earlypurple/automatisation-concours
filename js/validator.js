// js/validator.js
// Module de validation des données

class DataValidator {
    constructor() {
        this.schemas = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^(?:\+33|0)[1-9](?:[0-9]{8})$/,
            url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
            zipCode: /^[0-9]{5}$/
        };
    }

    validateEmail(email) {
        return {
            isValid: this.schemas.email.test(email),
            errors: this.schemas.email.test(email) ? [] : ['Format email invalide']
        };
    }

    validatePhone(phone) {
        return {
            isValid: this.schemas.phone.test(phone),
            errors: this.schemas.phone.test(phone) ? [] : ['Format téléphone invalide (format français requis)']
        };
    }

    validateUrl(url) {
        const errors = [];
        let isValid = true;

        if (!this.schemas.url.test(url)) {
            errors.push('Format URL invalide');
            isValid = false;
        }

        // Vérification HTTPS pour les domaines externes
        if (isValid && !url.startsWith('https://') && !url.includes('localhost')) {
            errors.push('HTTPS requis pour les domaines externes');
            isValid = false;
        }

        return { isValid, errors };
    }

    validateUserData(userData) {
        const errors = [];
        const requiredFields = ['name', 'email'];
        
        // Vérification des champs requis
        requiredFields.forEach(field => {
            if (!userData[field] || userData[field].trim() === '') {
                errors.push(`Le champ ${field} est requis`);
            }
        });

        // Validation de l'email
        if (userData.email) {
            const emailValidation = this.validateEmail(userData.email);
            errors.push(...emailValidation.errors);
        }

        // Validation du téléphone (optionnel)
        if (userData.phone) {
            const phoneValidation = this.validatePhone(userData.phone);
            errors.push(...phoneValidation.errors);
        }

        // Validation du nom (longueur)
        if (userData.name && (userData.name.length < 2 || userData.name.length > 50)) {
            errors.push('Le nom doit contenir entre 2 et 50 caractères');
        }

        // Validation de l'âge (si fourni)
        if (userData.age !== undefined) {
            const age = parseInt(userData.age);
            if (isNaN(age) || age < 13 || age > 120) {
                errors.push('L\'âge doit être entre 13 et 120 ans');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateOpportunity(opportunity) {
        const errors = [];

        // Champs requis
        const requiredFields = ['id', 'title', 'url', 'expires_at'];
        requiredFields.forEach(field => {
            if (!opportunity[field]) {
                errors.push(`Le champ ${field} est requis`);
            }
        });

        // Validation de l'URL
        if (opportunity.url) {
            const urlValidation = this.validateUrl(opportunity.url);
            errors.push(...urlValidation.errors);
        }

        // Validation de la date d'expiration
        if (opportunity.expires_at) {
            const expirationDate = new Date(opportunity.expires_at);
            if (isNaN(expirationDate.getTime())) {
                errors.push('Date d\'expiration invalide');
            } else if (expirationDate <= new Date()) {
                errors.push('L\'opportunité a déjà expiré');
            }
        }

        // Validation de la priorité
        if (opportunity.priority !== undefined) {
            const priority = parseInt(opportunity.priority);
            if (isNaN(priority) || priority < 1 || priority > 10) {
                errors.push('La priorité doit être entre 1 et 10');
            }
        }

        // Validation de la valeur
        if (opportunity.value !== undefined) {
            const value = parseFloat(opportunity.value);
            if (isNaN(value) || value < 0 || value > 10000) {
                errors.push('La valeur doit être entre 0 et 10000');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Suppression des caractères dangereux
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }

    sanitizeUserData(userData) {
        const sanitized = {};
        
        Object.keys(userData).forEach(key => {
            if (typeof userData[key] === 'string') {
                sanitized[key] = this.sanitizeInput(userData[key]);
            } else {
                sanitized[key] = userData[key];
            }
        });

        return sanitized;
    }
}

// Export pour utilisation comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataValidator;
}