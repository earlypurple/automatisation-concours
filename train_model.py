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
    Charge les données, prépare les données, entraîne un modèle de classification
    et le sauvegarde.
    """
    active_profile = db.get_active_profile()
    if not active_profile:
        print("Aucun profil actif trouvé. Impossible d'entraîner le modèle.")
        return

    profile_id = active_profile['id']
    print(f"Entraînement du modèle pour le profil : {active_profile['name']} (ID: {profile_id})")

    history_data = db.get_participation_history(profile_id)
    if not history_data:
        print("Pas de données d'historique pour l'entraînement.")
        return

    df = pd.DataFrame(history_data)

    # Filtrer pour n'inclure que les résultats finaux (gagné/perdu)
    df = df[df['participation_status'].isin(['won', 'lost'])]

    if len(df) < 10:
        print("Pas assez de données (gagné/perdu) pour l'entraînement.")
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

    model = Pipeline(steps=[('preprocessor', preprocessor),
                            ('classifier', lgb.LGBMClassifier(objective='binary',
                                                              class_weight='balanced',
                                                              n_estimators=100,
                                                              learning_rate=0.1,
                                                              num_leaves=31))])

    X = df[numeric_features + categorical_features]
    y = df['target']

    if len(y.unique()) < 2:
        print("Pas assez de classes dans la cible pour la stratification. Entraînement annulé.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    print("\n--- Évaluation du Modèle ---")
    print(f"  Précision (Accuracy): {accuracy:.2f}")
    print(f"  Précision (Precision): {precision:.2f}")
    print(f"  Rappel (Recall): {recall:.2f}")
    print(f"  Score F1: {f1:.2f}")
    print("---------------------------\n")

    joblib.dump(model, 'opportunity_model.joblib')
    print("Modèle sauvegardé dans 'opportunity_model.joblib'")

    try:
        import main
        main.reload_model()
    except ImportError:
        print("⚠️  Impossible de recharger le modèle automatiquement. Un redémarrage de l'application est nécessaire.")

if __name__ == '__main__':
    db.init_db()
    train_and_save_model()
