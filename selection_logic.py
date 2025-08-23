import pandas as pd
from datetime import datetime

# Le modèle est maintenant injecté par le script principal (main.py)
# pour permettre le rechargement à chaud.
model = None


def calculate_score_fallback(opportunity):
    """
    Logique de score de base si le modèle n'est pas disponible.
    """
    score = 0
    score += (opportunity.get('value') or 0) * 1.5
    score += (opportunity.get('priority') or 0) * 10

    entries = opportunity.get('entries_count')
    if entries is not None and entries > 0:
        score -= (entries / 100)

    # Logique simple pour le temps restant
    expires_at = opportunity.get('expires_at')
    if expires_at:
        try:
            time_left = datetime.fromisoformat(expires_at) - datetime.now()
            if time_left.days < 2:
                score += 20 # Bonus pour les opportunités qui expirent bientôt
        except (ValueError, TypeError):
            pass

    return max(0, score)

def calculate_score(opportunity):
    """
    Calcule un score en utilisant le modèle de ML si disponible,
    sinon utilise la logique de fallback.
    """
    if model is None:
        return calculate_score_fallback(opportunity)

    try:
        # Préparer les données pour le modèle
        data = {
            'value': [opportunity.get('value', 0)],
            'priority': [opportunity.get('priority', 0)],
            'entries_count': [opportunity.get('entries_count', 0)],
            'type': [opportunity.get('type', 'unknown')],
            'site': [opportunity.get('site', 'unknown')]
        }

        expires_at = opportunity.get('expires_at')
        time_left_days = 30 # Valeur par défaut
        if expires_at:
            try:
                time_left_days = (datetime.fromisoformat(expires_at) - datetime.now()).total_seconds() / (3600 * 24)
            except (ValueError, TypeError):
                pass
        data['time_left_days'] = [time_left_days]

        df = pd.DataFrame(data)

        # Le modèle retourne les probabilités pour les classes 0 et 1
        # On veut la probabilité de la classe 1 (won)
        win_probability = model.predict_proba(df)[0][1]

        # Le score est la probabilité de gain (entre 0 et 1, multiplié par 100)
        return win_probability * 100

    except Exception as e:
        print(f"Erreur lors du calcul du score avec le modèle: {e}")
        return calculate_score_fallback(opportunity)
