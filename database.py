import sqlite3
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
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initializes the database and creates the table if it doesn't exist."""
    with db_cursor() as cur:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS opportunities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                url TEXT NOT NULL,
                type TEXT,
                priority INTEGER,
                value REAL,
                auto_fill BOOLEAN,
                detected_at TEXT NOT NULL,
                expires_at TEXT,
                status TEXT DEFAULT 'pending',
                log TEXT DEFAULT '',
                entries_count INTEGER,
                time_left TEXT,
                score REAL,
                confirmation_details TEXT
            )
        ''')

import datetime

def add_opportunity(opp):
    """Adds a new opportunity to the database."""
    with db_cursor() as cur:
        cur.execute('''
            INSERT INTO opportunities (site, title, description, url, type, priority, value, auto_fill, detected_at, expires_at, status, entries_count, time_left, score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
            opp.get('time_left')
        ))

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


def clear_opportunities():
    """Clears all opportunities from the database."""
    with db_cursor() as cur:
        cur.execute('DELETE FROM opportunities')

import selection_logic

def update_all_scores():
    """Calculates and updates the score for all opportunities."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM opportunities")
        opportunities = [dict(row) for row in cur.fetchall()]

        for opp in opportunities:
            score = selection_logic.calculate_score(opp)
            cur.execute("UPDATE opportunities SET score = ? WHERE id = ?", (score, opp['id']))

        print(f"Scores updated for {len(opportunities)} opportunities.")

def get_opportunity_by_id(opportunity_id):
    """Fetches a single opportunity by its ID."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def get_opportunities():
    """Fetches all opportunities from the database."""
    with db_cursor() as cur:
        cur.execute('SELECT * FROM opportunities ORDER BY score DESC, priority DESC, value DESC')
        rows = cur.fetchall()
        # Convert rows to dictionaries
        return [dict(row) for row in rows]
