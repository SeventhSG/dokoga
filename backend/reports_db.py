"""SQLite schema + connection for the citizen report loop.
Reuses the same projects.sqlite as backend/tools.py."""
import os, sqlite3

DB = os.path.join(os.path.dirname(__file__), "..", "data", "app", "projects.sqlite")

def con() -> sqlite3.Connection:
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, phone_hash TEXT, email_hash TEXT, name TEXT,
  trust_score REAL DEFAULT 1.0, banned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')));
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email_hash);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY, user_id INTEGER, fingerprint TEXT,
  first_seen TEXT DEFAULT (datetime('now')), UNIQUE(user_id, fingerprint));
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY, lat REAL, lng REAL, geohash TEXT, category TEXT,
  note TEXT, created_by INTEGER, status TEXT DEFAULT 'reported',
  region_name TEXT, suggested_contracts TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_reports_geohash ON reports(geohash);
CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY, report_id INTEGER, user_id INTEGER, device_id INTEGER,
  ip_hash TEXT, kind TEXT DEFAULT 'confirm', created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(report_id, user_id));
CREATE TABLE IF NOT EXISTS email_codes (
  id INTEGER PRIMARY KEY, email_hash TEXT, code_hash TEXT, name TEXT,
  attempts INTEGER DEFAULT 0, consumed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_codes_email ON email_codes(email_hash, created_at);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE, user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')));
"""

# Columns added to `users` after the first release (migrate existing DBs).
_USER_MIGRATIONS = {"email_hash": "TEXT", "name": "TEXT"}


def init_db(c: sqlite3.Connection) -> None:
    # Migrate an existing pre-email users table before creating indexes on it.
    have = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "users" in have:
        cols = {r[1] for r in c.execute("PRAGMA table_info(users)")}
        for name, typ in _USER_MIGRATIONS.items():
            if name not in cols:
                c.execute(f"ALTER TABLE users ADD COLUMN {name} {typ}")
    c.executescript(SCHEMA)
    c.commit()
