import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib
import database as db
import numpy as np
from datetime import datetime
from logger import logger

def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prépare le DataFrame pour l'entraînement en nettoyant les données et
    en créant de nouvelles caractéristiques.
    """
    # Copier le DataFrame pour éviter les avertissements SettingWithCopyWarning
    df = df.copy()

    # Définir la variable cible
    df['target'] = df['participation_status'].apply(lambda x: 1 if x == 'won' else 0)

    # Remplacer les None par 0 pour les caractéristiques numériques
    df['entries_count'] = df['entries_count'].fillna(0)
    df['value'] = df['value'].fillna(0)
    df['priority'] = df['priority'].fillna(0)

    # Calculer le temps restant en jours
    df['expires_at'] = pd.to_datetime(df['expires_at'], errors='coerce')
    now = datetime.now()
    df['time_left_days'] = (df['expires_at'] - now).dt.total_seconds() / (3600 * 24)
    # Remplacer les NaN (dates invalides ou absentes) par une valeur par défaut de 30 jours
    df['time_left_days'] = df['time_left_days'].fillna(30)

    return df

def train_and_save_model():
    """

    """
    active_profile = db.get_active_profile()
    if not active_profile:
        logger.warning("Aucun profil actif trouvé. Impossible d'entraîner le modèle.")
        return

    profile_id = active_profile['id']
    logger.info(f"Entraînement du modèle pour le profil : {active_profile['name']} (ID: {profile_id})")

    history_data = db.get_participation_history(profile_id)
    if not history_data:
        logger.info("Pas de données d'historique pour l'entraînement.")
        return

    df = pd.DataFrame(history_data)

    # Filtrer pour n'inclure que les résultats finaux (gagné/perdu)
    df = df[df['participation_status'].isin(['won', 'lost'])]

    if len(df) < 10:
        logger.info("Pas assez de données (gagné/perdu) pour l'entraînement.")
        return

    # Préparer les données en utilisant la nouvelle fonction
    df = prepare_data(df)

    numeric_features = ['value', 'priority', 'entries_count', 'time_left_days']
    categorical_features = ['type', 'site']

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', 'passthrough', numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ])

    # Définir le modèle
    model = Pipeline(steps=[('preprocessor', preprocessor),
                      ('classifier', lgb.LGBMClassifier(random_state=42))])

    X = df[numeric_features + categorical_features]
    y = df['target']


    if len(y.unique()) < 2:
        logger.warning("Pas assez de classes dans la cible pour la stratification. Entraînement annulé.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    logger.info("\n--- Évaluation du Modèle ---")
    logger.info(f"  Précision (Accuracy): {accuracy:.2f}")
    logger.info(f"  Précision (Precision): {precision:.2f}")
    logger.info(f"  Rappel (Recall): {recall:.2f}")
    logger.info(f"  Score F1: {f1:.2f}")
    logger.info("---------------------------\n")

    joblib.dump(model, 'opportunity_model.joblib')
    logger.info("Modèle sauvegardé dans 'opportunity_model.joblib'")

    try:
        import main
        main.reload_model()
    except ImportError:
        logger.warning("⚠️  Impossible de recharger le modèle automatiquement. Un redémarrage de l'application est nécessaire.")

if __name__ == '__main__':
    db.run_migrations()
    db.init_db()
    train_and_save_model()
