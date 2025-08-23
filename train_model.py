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

def train_and_save_model():
    """
    Charge les données de l'historique de participation pour le profil actif,
    entraîne un modèle de classification et le sauvegarde.
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

    if len(df) < 10: # Pas assez de données pour un entraînement significatif
        print("Pas assez de données (gagné/perdu) pour l'entraînement.")
        return

    # Définir la variable cible
    df['target'] = df['participation_status'].apply(lambda x: 1 if x == 'won' else 0)

    # Définir les caractéristiques (features)
    # Remplacer les None par 0 pour entries_count et value
    df['entries_count'] = df['entries_count'].fillna(0)
    df['value'] = df['value'].fillna(0)
    df['priority'] = df['priority'].fillna(0)

    # Calculer le temps restant en jours (si 'expires_at' est disponible)
    df['expires_at'] = pd.to_datetime(df['expires_at'], errors='coerce')
    df['time_left_days'] = (df['expires_at'] - pd.to_datetime('now')).dt.total_seconds() / (3600 * 24)
    df['time_left_days'] = df['time_left_days'].fillna(30) # Remplacer les NaN par une valeur par défaut (ex: 30 jours)


    numeric_features = ['value', 'priority', 'entries_count', 'time_left_days']
    categorical_features = ['type', 'site']

    # Créer un transformateur pour le pré-traitement
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', 'passthrough', numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ])

    # Créer le pipeline avec le pré-processeur et le modèle LightGBM
    model = Pipeline(steps=[('preprocessor', preprocessor),
                            ('classifier', lgb.LGBMClassifier(objective='binary',
                                                              class_weight='balanced',
                                                              n_estimators=100,
                                                              learning_rate=0.1,
                                                              num_leaves=31))])

    # Diviser les données
    X = df[numeric_features + categorical_features]
    y = df['target']

    # S'assurer qu'il y a au moins deux classes pour la stratification
    if len(y.unique()) < 2:
        print("Pas assez de classes dans la cible pour la stratification. Entraînement annulé.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Entraîner le modèle
    model.fit(X_train, y_train)

    # Évaluer le modèle
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

    # Sauvegarder le modèle et les colonnes
    joblib.dump(model, 'opportunity_model.joblib')
    print("Modèle sauvegardé dans 'opportunity_model.joblib'")

    # Recharger le modèle dans l'application principale pour une utilisation immédiate
    # L'importation est faite ici pour éviter les dépendances circulaires
    try:
        import main
        main.reload_model()
    except ImportError:
        # Cela peut se produire si le script est exécuté de manière autonome
        print("⚠️  Impossible de recharger le modèle automatiquement. Un redémarrage de l'application est nécessaire.")

if __name__ == '__main__':
    db.init_db()
    train_and_save_model()
