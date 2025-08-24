import datetime
import json
from contextlib import contextmanager

from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker

import selection_logic
from logger import logger
from models import Base, Opportunity, Profile, ParticipationHistory


def model_to_dict(obj):
    """Converts a SQLAlchemy model instance to a dictionary."""
    if obj is None:
        return None
    # Handle lists of objects
    if isinstance(obj, list):
        return [model_to_dict(item) for item in obj]

    # Handle single objects
    if hasattr(obj, '__table__'):
        data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        # Handle JSON fields that might be strings
        for key, value in data.items():
            if isinstance(value, str) and key in ('user_data', 'settings', 'confirmation_details'):
                try:
                    data[key] = json.loads(value)
                except json.JSONDecodeError:
                    pass  # Keep as string if not valid JSON
        return data
    return obj

engine = None
DBSession = None
DB_FILE = None

def init_engine(db_file='surveillance.db'):
    """Initializes the database engine and session maker."""
    global engine, DBSession, DB_FILE
    DB_FILE = db_file
    engine = create_engine(f'sqlite:///{DB_FILE}?check_same_thread=False', echo=False)
    Base.metadata.bind = engine
    DBSession = sessionmaker(bind=engine)

@contextmanager
def db_session():
    """Provide a transactional scope around a series of operations."""
    if DBSession is None:
        init_engine()
    session = DBSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """
    Initializes the database by creating a default profile if none exists.
    Schema creation is now handled by the migration system.
    """
    with db_session() as session:
        if session.query(Profile).count() == 0:
            logger.info("No profiles found. Creating a default profile...")
            default_user_data = json.dumps({
                "name": "John Doe",
                "email": "johndoe@example.com",
                "phone": "1234567890",
                "address": "123 Main St"
            })
            default_profile = Profile(
                name='Défaut',
                user_data=default_user_data,
                is_active=True
            )
            session.add(default_profile)
            logger.info("Default profile created.")


def add_opportunity(opp, profile_id):
    """
    Adds a new opportunity to the database if it doesn't already exist for the profile.
    Returns True if the opportunity was added, False otherwise.
    """
    with db_session() as session:
        existing_opp = session.query(Opportunity).filter_by(url=opp['url'], profile_id=profile_id).first()
        if existing_opp:
            return False  # Opportunity already exists

        new_opp = Opportunity(
            site=opp['site'],
            title=opp['title'],
            description=opp['description'],
            url=opp['url'],
            type=opp['type'],
            priority=opp['priority'],
            value=opp['value'],
            auto_fill=opp.get('auto_fill', False),
            detected_at=opp['detected_at'],
            expires_at=opp['expires_at'],
            status='pending',
            entries_count=opp.get('entries_count'),
            time_left=opp.get('time_left'),
            score=0,
            profile_id=profile_id,
            log=''
        )
        session.add(new_opp)
        return True


def update_opportunity_status(opportunity_id, status, log_message=None):
    """Updates the status and log of an opportunity."""
    with db_session() as session:
        opp = session.query(Opportunity).filter_by(id=opportunity_id).first()
        if opp:
            opp.status = status
            if log_message:
                log_entry = f"[{datetime.datetime.now().isoformat()}] {log_message}\n"
                opp.log += log_entry


def set_confirmation_pending(opportunity_id, domain):
    """Marks an opportunity as pending email confirmation and stores necessary details."""
    with db_session() as session:
        opp = session.query(Opportunity).filter_by(id=opportunity_id).first()
        if opp:
            details = {
                'domain': domain,
                'timestamp': datetime.datetime.now().isoformat()
            }
            opp.status = 'email_confirmation_pending'
            opp.confirmation_details = json.dumps(details)
            log_entry = f"[{details['timestamp']}] Participation réussie, en attente de confirmation par e-mail.\n"
            opp.log += log_entry


def clear_opportunities(profile_id):
    """Clears all opportunities from the database for a specific profile."""
    with db_session() as session:
        session.query(Opportunity).filter_by(profile_id=profile_id).delete()


def update_all_scores(profile_id):
    """Calculates and updates the score for all opportunities of a specific profile."""
    with db_session() as session:
        opportunities = session.query(Opportunity).filter_by(profile_id=profile_id).all()
        for opp in opportunities:
            # The selection_logic function expects a dict, so we convert the object
            # This is a temporary step. Ideally, selection_logic would also be updated.
            opp_dict = {c.name: getattr(opp, c.name) for c in opp.__table__.columns}
            opp.score = selection_logic.calculate_score(opp_dict)
        logger.info(f"Scores updated for {len(opportunities)} opportunities for profile {profile_id}.")


def get_opportunity_by_id(opportunity_id):
    """Fetches a single opportunity by its ID."""
    with db_session() as session:
        opp = session.query(Opportunity).filter_by(id=opportunity_id).first()
        return model_to_dict(opp)


def get_opportunities(profile_id):
    """Fetches all opportunities from the database for a specific profile."""
    with db_session() as session:
        opps = session.query(Opportunity).filter_by(profile_id=profile_id)\
            .order_by(Opportunity.score.desc(), Opportunity.priority.desc(), Opportunity.value.desc())\
            .all()
        return model_to_dict(opps)


def get_pending_confirmation_opportunities(profile_id):
    """Fetches opportunities pending email confirmation for a specific profile."""
    with db_session() as session:
        opps = session.query(Opportunity)\
            .filter_by(status='email_confirmation_pending', profile_id=profile_id)\
            .all()
        return model_to_dict(opps)


def add_participation_history(opportunity_id, status, profile_id):
    """Adds a record to the participation history for a specific profile."""
    with db_session() as session:
        new_history = ParticipationHistory(
            opportunity_id=opportunity_id,
            participation_date=datetime.datetime.now().isoformat(),
            status=status,
            profile_id=profile_id
        )
        session.add(new_history)


def get_participation_history(profile_id):
    """Fetches the participation history with opportunity details for a specific profile."""
    with db_session() as session:
        results = session.query(ParticipationHistory, Opportunity)\
            .join(Opportunity, ParticipationHistory.opportunity_id == Opportunity.id)\
            .filter(Opportunity.profile_id == profile_id)\
            .all()

        # Manually construct a list of dicts to match the original output format
        history_list = []
        for history, opportunity in results:
            hist_dict = model_to_dict(opportunity)
            hist_dict['participation_status'] = history.status
            history_list.append(hist_dict)
        return history_list

# --- Fonctions de gestion des profils ---


def get_profiles():
    """Récupère tous les profils."""
    with db_session() as session:
        return model_to_dict(session.query(Profile).all())


def get_active_profile():
    """Récupère le profil actif."""
    with db_session() as session:
        active_profile = session.query(Profile).filter_by(is_active=True).first()
        if not active_profile:
            active_profile = session.query(Profile).order_by(Profile.id).first()
        return model_to_dict(active_profile)


def set_active_profile(profile_id):
    """Définit le profil actif."""
    with db_session() as session:
        session.query(Profile).update({Profile.is_active: False})
        session.query(Profile).filter_by(id=profile_id).update({Profile.is_active: True})


def create_profile(name, email=None, user_data=None, settings=None):
    """Crée un nouveau profil."""
    with db_session() as session:
        new_profile = Profile(
            name=name,
            email=email,
            user_data=json.dumps(user_data or {}),
            settings=json.dumps(settings or {})
        )
        session.add(new_profile)
        session.flush()  # To get the ID before committing
        return new_profile.id


def update_profile(profile_id, name=None, email=None, user_data=None, settings=None):
    """Met à jour un profil existant."""
    with db_session() as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if profile:
            if name:
                profile.name = name
            if email:
                profile.email = email
            if user_data:
                profile.user_data = json.dumps(user_data)
            if settings:
                profile.settings = json.dumps(settings)


def delete_profile(profile_id):
    """Supprime un profil et les données associées."""
    with db_session() as session:
        if session.query(Profile).count() <= 1:
            raise ValueError("Impossible de supprimer le dernier profil.")

        profile_to_delete = session.query(Profile).filter_by(id=profile_id).first()
        if not profile_to_delete:
            return

        is_deleting_active = profile_to_delete.is_active

        # Cascading delete should handle associated data if configured,
        # but to be safe and explicit, we delete them manually.
        session.query(Opportunity).filter_by(profile_id=profile_id).delete()
        session.query(ParticipationHistory).filter_by(profile_id=profile_id).delete()

        session.delete(profile_to_delete)

        if is_deleting_active:
            first_profile = session.query(Profile).order_by(Profile.id).first()
            if first_profile:
                first_profile.is_active = True

def check_db_status():
    """Vérifie l'état de la base de données."""
    try:
        with db_session() as session:
            session.query(1).one()
        return "ok"
    except Exception as e:
        logger.error(f"Erreur de connexion à la base de données: {e}")
        return "error"

# Initialize the engine for normal application startup
init_engine()
