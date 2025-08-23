"""
Module pour la logique de sélection intelligente des opportunités.
"""

def calculate_score(opportunity):
    """
    Calcule un score pour une seule opportunité.
    Le score est basé sur la valeur, la priorité, et le nombre de participants.
    """
    score = 0

    # Bonus pour la valeur
    score += opportunity.get('value', 0) * 1.5

    # Bonus pour la priorité
    score += (opportunity.get('priority', 0) * 10)

    # Pénalité pour le nombre de participants (si disponible)
    # Moins il y a de participants, meilleur est le score.
    entries = opportunity.get('entries_count')
    if entries is not None and entries > 0:
        score -= (entries / 100)

    # TODO: Ajouter une logique pour 'time_left'

    return max(0, score) # S'assurer que le score n'est pas négatif

def update_scores_in_db(db_connection):
    """
    Récupère toutes les opportunités, calcule leur score,
    et met à jour la base de données.
    """
    # Cette approche est moins efficace (N+1 updates).
    # Une meilleure approche serait de faire le calcul et un seul bulk update.
    # Mais pour la simplicité, nous allons faire comme ça pour l'instant.

    cur = db_connection.cursor()
    cur.execute("SELECT * FROM opportunities")
    opportunities = [dict(row) for row in cur.fetchall()]

    for opp in opportunities:
        score = calculate_score(opp)
        cur.execute("UPDATE opportunities SET score = ? WHERE id = ?", (score, opp['id']))

    db_connection.commit()
    print(f"{len(opportunities)} scores mis à jour dans la base de données.")
