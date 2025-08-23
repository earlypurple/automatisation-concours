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
                expires_at TEXT
            )
        ''')

def add_opportunity(opp):
    """Adds a new opportunity to the database."""
    with db_cursor() as cur:
        cur.execute('''
            INSERT INTO opportunities (site, title, description, url, type, priority, value, auto_fill, detected_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            opp['expires_at']
        ))

def clear_opportunities():
    """Clears all opportunities from the database."""
    with db_cursor() as cur:
        cur.execute('DELETE FROM opportunities')

def get_opportunities():
    """Fetches all opportunities from the database."""
    with db_cursor() as cur:
        cur.execute('SELECT * FROM opportunities ORDER BY priority DESC, value DESC')
        rows = cur.fetchall()
        # Convert rows to dictionaries
        return [dict(row) for row in rows]
