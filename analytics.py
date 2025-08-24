from collections import defaultdict
from datetime import datetime
from database import db_session, Opportunity, ParticipationHistory

def get_analytics_data(profile_id):
    """
    Calcule les statistiques d'analyse pour le tableau de bord à partir de la base de données.
    """
    if profile_id is None:
        return {
            "opportunities_over_time": [],
            "success_rate": 0,
            "total_participations": 0,
            "counts_by_status": {}
        }

    with db_session() as session:
        # 1. Agréger les opportunités par mois
        opportunities_over_time = defaultdict(int)
        opportunities = session.query(Opportunity.detected_at).filter_by(profile_id=profile_id).all()

        for opp in opportunities:
            try:
                # `detected_at` est au format ISO
                detected_date = datetime.fromisoformat(opp.detected_at)
                month_key = detected_date.strftime('%Y-%m')  # Format 'YYYY-MM'
                opportunities_over_time[month_key] += 1
            except (ValueError, TypeError):
                continue  # Ignorer les dates au format incorrect

        # Formatter pour `recharts`, en s'assurant que c'est trié
        chart_data = []
        for month_key, count in opportunities_over_time.items():
            try:
                date_obj = datetime.strptime(month_key, '%Y-%m')
                # Format "Mois Année" (ex: Jan 2023) pour l'affichage
                month_name = date_obj.strftime('%b')
                chart_data.append({'name': f"{month_name} {date_obj.year}", 'opportunités': count, 'sort_key': month_key})
            except ValueError:
                continue

        # Trier par clé (YYYY-MM) pour assurer l'ordre chronologique
        chart_data.sort(key=lambda x: x['sort_key'])
        for item in chart_data:
            del item['sort_key']  # Retirer la clé de tri

        # 2. Calculer le taux de succès et autres statistiques de participation
        history_rows = session.query(ParticipationHistory.status).filter_by(profile_id=profile_id).all()

    total_participations = len(history_rows)
    counts_by_status = defaultdict(int)
    for row in history_rows:
        counts_by_status[row.status] += 1

    # Les statuts 'participated' et 'success' sont tous deux considérés comme des succès
    successful_participations = counts_by_status.get('participated', 0) + counts_by_status.get('success', 0)

    success_rate = (successful_participations / total_participations * 100) if total_participations > 0 else 0

    return {
        "opportunities_over_time": chart_data,
        "success_rate": round(success_rate, 2),
        "total_participations": total_participations,
        "counts_by_status": dict(counts_by_status)
    }
