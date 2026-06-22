-- IntegrityBG — POC slice schema (SQLite; types kept Postgres-compatible).
-- Procurement (ЦАИС ЕОП) + ownership (Търговски регистър) joined by ЕИК; persons by stable ЕГН hash.

CREATE TABLE IF NOT EXISTS organizations (
  eik             TEXT PRIMARY KEY,
  name            TEXT,
  legal_form      TEXT,
  tr_seen_at      TEXT
);

CREATE TABLE IF NOT EXISTS persons (
  person_key      TEXT PRIMARY KEY,   -- hashed ЕГН / UIC / 'name:'+norm fallback
  indent_type     TEXT,               -- EGN | BirthDate | UIC | LNCH | NAME
  name            TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  eik             TEXT NOT NULL,      -- company the person is attached to
  person_key      TEXT NOT NULL,
  role            TEXT NOT NULL,      -- manager | owner | partner | representative | other
  PRIMARY KEY (eik, person_key, role)
);
CREATE INDEX IF NOT EXISTS idx_roles_person ON roles(person_key);
CREATE INDEX IF NOT EXISTS idx_roles_eik ON roles(eik);

CREATE TABLE IF NOT EXISTS tenders (
  unp             TEXT PRIMARY KEY,
  notice_id       TEXT,
  title           TEXT,
  buyer_eik       TEXT,
  cpv             TEXT,
  estimated_value REAL,
  currency        TEXT,
  published_at    TEXT,
  deadline_at     TEXT,
  is_cancelled    INTEGER,
  procedure_type  TEXT
);

CREATE TABLE IF NOT EXISTS contracts (
  id              TEXT PRIMARY KEY,   -- noticeId (+contractNumber when needed)
  unp             TEXT,
  buyer_eik       TEXT,
  buyer_name      TEXT,
  supplier_eik    TEXT,
  supplier_name   TEXT,
  cpv             TEXT,
  contract_value  REAL,
  estimated_value REAL,
  currency        TEXT,
  amount_eur      REAL,
  offers_count    INTEGER,
  disqualified_count INTEGER,
  published_at    TEXT,
  contract_date   TEXT,
  procedure_type  TEXT
);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON contracts(supplier_eik);
CREATE INDEX IF NOT EXISTS idx_contracts_buyer ON contracts(buyer_eik);
CREATE INDEX IF NOT EXISTS idx_contracts_cpv ON contracts(cpv);

CREATE TABLE IF NOT EXISTS annexes (
  id              TEXT PRIMARY KEY,
  unp             TEXT,
  value_before    REAL,
  value_after     REAL,
  value_delta     REAL,
  published_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_annexes_unp ON annexes(unp);

CREATE TABLE IF NOT EXISTS flags (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type  TEXT NOT NULL,   -- contract | entity
  target_id    TEXT NOT NULL,
  code         TEXT NOT NULL,
  severity     REAL NOT NULL,   -- 0..1
  evidence     TEXT NOT NULL,   -- JSON
  computed_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flags_target ON flags(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_flags_code ON flags(code);

CREATE TABLE IF NOT EXISTS integrity_scores (
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  score       REAL NOT NULL,   -- 0..1 (noisy-OR of weighted flag severities)
  level       TEXT NOT NULL,   -- low | med | high
  flag_codes  TEXT NOT NULL,   -- comma-separated contributing codes
  PRIMARY KEY (target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_integrity_level ON integrity_scores(level);
