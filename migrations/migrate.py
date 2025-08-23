import sqlite3
import os
import sys

# Adjust the path to import from the root directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database import db_cursor

MIGRATIONS_DIR = os.path.dirname(__file__)
VERSIONS_DIR = os.path.join(MIGRATIONS_DIR, 'versions')

def get_db_file():
    """Gets the database file from command-line arguments or uses the default."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    # This fallback is for when the script is run directly without args
    from database import DB_FILE
    return DB_FILE

def get_applied_migrations(cursor):
    """Gets the set of applied migration filenames."""
    try:
        cursor.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cursor.fetchall()}
    except sqlite3.OperationalError:
        # If the table doesn't exist, no migrations have been applied
        return set()

def apply_migration(cursor, filepath):
    """Applies a single migration script."""
    filename = os.path.basename(filepath)
    print(f"Applying migration: {filename}...")
    with open(filepath, 'r') as f:
        sql_script = f.read()

    # We use executescript for files that might contain multiple statements
    cursor.executescript(sql_script)

    # Record the migration
    cursor.execute("INSERT INTO schema_migrations (version) VALUES (?)", (filename,))
    print(f"Successfully applied {filename}.")

def main():
    """
    Main function to run the database migrations.
    - Creates the schema_migrations table if it doesn't exist.
    - Finds all .sql files in the versions directory.
    - Applies any migrations that haven't been applied yet.
    """
    db_file = get_db_file()
    print(f"Applying migrations to database: {db_file}")

    # We need to manually manage the connection here to pass the db_file
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()

    try:
        # 1. Create the migrations tracking table if it doesn't exist
        cur.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 2. Get the list of already applied migrations
        applied_migrations = get_applied_migrations(cur)

        # 3. Find all migration files and sort them
        migration_files = sorted([
            f for f in os.listdir(VERSIONS_DIR)
            if f.endswith('.sql')
        ])

        # 4. Apply any new migrations
        for filename in migration_files:
            if filename not in applied_migrations:
                filepath = os.path.join(VERSIONS_DIR, filename)
                apply_migration(cur, filepath)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    # This allows the script to be run directly for manual migrations
    print("Running database migrations...")
    main()
    print("All migrations applied successfully.")
