-- migrations/versions/0001_initial_schema.sql

-- --- Table des Profils ---
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    user_data TEXT, -- JSON for form filling
    settings TEXT, -- JSON for profile-specific settings
    is_active BOOLEAN DEFAULT 0
);

-- --- Table des Opportunités ---
CREATE TABLE opportunities (
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
    confirmation_details TEXT,
    profile_id INTEGER REFERENCES profiles(id)
);

-- --- Table de l'Historique ---
CREATE TABLE participation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    participation_date TEXT NOT NULL,
    status TEXT NOT NULL,
    profile_id INTEGER REFERENCES profiles(id),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities (id)
);
