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
  id INTEGER PRIMARY KEY, phone_hash TEXT UNIQUE, trust_score REAL DEFAULT 1.0,
  banned INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
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
"""

def init_db(c: sqlite3.Connection) -> None:
    c.executescript(SCHEMA)
    c.commit()
