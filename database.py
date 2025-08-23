import sqlite3
import os
from contextlib import contextmanager

DB_FILE = 'surveillance.db'

@contextmanager
def db_cursor():
    """Context manager for database cursor."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except sqlite3.Error:
        conn.rollback()
        raise
    finally:
        conn.close()

import json
import subprocess
from logger import logger

def run_migrations():
    """Runs the database migration scripts."""
    logger.info("Running database migrations...")
    # We run this as a subprocess to ensure it's using the correct context
    # and pass the database file as an argument.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migration_script = os.path.join(script_dir, 'migrations', 'migrate.py')
    subprocess.run(['python', migration_script, DB_FILE], check=True)
    logger.info("Migrations completed.")

def init_db():
    """
    Initializes the database by creating a default profile if none exists.
    Schema creation is now handled by the migration system.
    """
    with db_cursor() as cur:
        # --- Check if a default profile needs to be created ---
        cur.execute("SELECT COUNT(*) FROM profiles")
        if cur.fetchone()[0] == 0:
            logger.info("No profiles found. Creating a default profile...")
            default_user_data = json.dumps({
                "name": "John Doe",
                "email": "johndoe@example.com",
                "phone": "1234567890",
                "address": "123 Main St"
            })
            cur.execute(
                "INSERT INTO profiles (name, user_data, is_active) VALUES (?, ?, ?)",
                ('Défaut', default_user_data, 1)
            )
            logger.info("Default profile created.")

import datetime

def add_opportunity(opp, profile_id):
    """
    Adds a new opportunity to the database if it doesn't already exist for the profile.
    Returns True if the opportunity was added, False otherwise.
    """
    with db_cursor() as cur:
        # Check if an opportunity with the same URL already exists for this profile
        cur.execute("SELECT id FROM opportunities WHERE url = ? AND profile_id = ?", (opp['url'], profile_id))
        if cur.fetchone():
            return False  # Opportunity already exists

        # If not, insert it
        cur.execute('''
            INSERT INTO opportunities (site, title, description, url, type, priority, value, auto_fill, detected_at, expires_at, status, entries_count, time_left, score, profile_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ''', (
            opp['site'],
            opp['title'],
            opp['description'],
            opp['url'],
            opp['type'],
            opp['priority'],
            opp['value'],
            opp.get('auto_fill', False),
            opp['detected_at'],
            opp['expires_at'],
            'pending', # Initial status
            opp.get('entries_count'),
            opp.get('time_left'),
            profile_id
        ))
        return True

def update_opportunity_status(opportunity_id, status, log_message=None):
    """Updates the status and log of an opportunity."""
    with db_cursor() as cur:
        if log_message:
            # Append new log message with a timestamp
            log_entry = f"[{datetime.datetime.now().isoformat()}] {log_message}\n"
            cur.execute("UPDATE opportunities SET status = ?, log = log || ? WHERE id = ?", (status, log_entry, opportunity_id))
        else:
            cur.execute("UPDATE opportunities SET status = ? WHERE id = ?", (status, opportunity_id))

import json

def set_confirmation_pending(opportunity_id, domain):
    """Marks an opportunity as pending email confirmation and stores necessary details."""
    details = {
        'domain': domain,
        'timestamp': datetime.datetime.now().isoformat()
    }
    with db_cursor() as cur:
        log_entry = f"[{details['timestamp']}] Participation réussie, en attente de confirmation par e-mail.\n"
        cur.execute(
            "UPDATE opportunities SET status = 'email_confirmation_pending', confirmation_details = ?, log = log || ? WHERE id = ?",
            (json.dumps(details), log_entry, opportunity_id)
        )


def clear_opportunities(profile_id):
    """Clears all opportunities from the database for a specific profile."""
    with db_cursor() as cur:
        cur.execute('DELETE FROM opportunities WHERE profile_id = ?', (profile_id,))

import selection_logic

def update_all_scores(profile_id):
    """Calculates and updates the score for all opportunities of a specific profile."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM opportunities WHERE profile_id = ?", (profile_id,))
        opportunities = [dict(row) for row in cur.fetchall()]

        for opp in opportunities:
            score = selection_logic.calculate_score(opp)
            cur.execute("UPDATE opportunities SET score = ? WHERE id = ?", (score, opp['id']))

        logger.info(f"Scores updated for {len(opportunities)} opportunities for profile {profile_id}.")

def get_opportunity_by_id(opportunity_id):
    """Fetches a single opportunity by its ID."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def get_opportunities(profile_id):
    """Fetches all opportunities from the database for a specific profile."""
    with db_cursor() as cur:
        cur.execute('SELECT * FROM opportunities WHERE profile_id = ? ORDER BY score DESC, priority DESC, value DESC', (profile_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def get_pending_confirmation_opportunities(profile_id):
    """Fetches opportunities pending email confirmation for a specific profile."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM opportunities WHERE status = 'email_confirmation_pending' AND profile_id = ?", (profile_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def add_participation_history(opportunity_id, status, profile_id):
    """Adds a record to the participation history for a specific profile."""
    with db_cursor() as cur:
        cur.execute('''
            INSERT INTO participation_history (opportunity_id, participation_date, status, profile_id)
            VALUES (?, ?, ?, ?)
        ''', (opportunity_id, datetime.datetime.now().isoformat(), status, profile_id))

def get_participation_history(profile_id):
    """Fetches the participation history with opportunity details for a specific profile."""
    with db_cursor() as cur:
        cur.execute('''
            SELECT
                h.status as participation_status,
                o.*
            FROM participation_history h
            JOIN opportunities o ON h.opportunity_id = o.id
            WHERE o.profile_id = ?
        ''', (profile_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

# --- Fonctions de gestion des profils ---

def get_profiles():
    """Récupère tous les profils."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM profiles")
        return [dict(row) for row in cur.fetchall()]

def get_active_profile():
    """Récupère le profil actif."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM profiles WHERE is_active = 1")
        row = cur.fetchone()
        if not row: # Si aucun n'est actif, retourne le premier
            cur.execute("SELECT * FROM profiles ORDER BY id LIMIT 1")
            row = cur.fetchone()
        return dict(row) if row else None

def set_active_profile(profile_id):
    """Définit le profil actif."""
    with db_cursor() as cur:
        cur.execute("UPDATE profiles SET is_active = 0")
        cur.execute("UPDATE profiles SET is_active = 1 WHERE id = ?", (profile_id,))

def create_profile(name, email=None, user_data=None, settings=None):
    """Crée un nouveau profil."""
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (name, email, user_data, settings) VALUES (?, ?, ?, ?)",
            (name, email, json.dumps(user_data or {}), json.dumps(settings or {}))
        )
        return cur.lastrowid

def update_profile(profile_id, name=None, email=None, user_data=None, settings=None):
    """Met à jour un profil existant."""
    with db_cursor() as cur:
        if name:
            cur.execute("UPDATE profiles SET name = ? WHERE id = ?", (name, profile_id))
        if email:
            cur.execute("UPDATE profiles SET email = ? WHERE id = ?", (email, profile_id))
        if user_data:
            cur.execute("UPDATE profiles SET user_data = ? WHERE id = ?", (json.dumps(user_data), profile_id))
        if settings:
            cur.execute("UPDATE profiles SET settings = ? WHERE id = ?", (json.dumps(settings), profile_id))

def delete_profile(profile_id):
    """Supprime un profil et les données associées."""
    with db_cursor() as cur:
        # Ne pas supprimer le dernier profil
        cur.execute("SELECT COUNT(*) FROM profiles")
        if cur.fetchone()[0] <= 1:
            raise ValueError("Impossible de supprimer le dernier profil.")

        # Vérifier si le profil à supprimer est actif
        cur.execute("SELECT is_active FROM profiles WHERE id = ?", (profile_id,))
        is_deleting_active = cur.fetchone()[0]

        # Supprimer les données associées
        cur.execute("DELETE FROM opportunities WHERE profile_id = ?", (profile_id,))
        cur.execute("DELETE FROM participation_history WHERE profile_id = ?", (profile_id,))

        # Supprimer le profil
        cur.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))

        # Si le profil supprimé était l'actif, en activer un autre
        if is_deleting_active:
            cur.execute("SELECT id FROM profiles ORDER BY id LIMIT 1")
            first_profile = cur.fetchone()
            if first_profile:
                # Utiliser le même curseur pour activer le nouveau profil
                cur.execute("UPDATE profiles SET is_active = 0")
                cur.execute("UPDATE profiles SET is_active = 1 WHERE id = ?", (first_profile['id'],))
