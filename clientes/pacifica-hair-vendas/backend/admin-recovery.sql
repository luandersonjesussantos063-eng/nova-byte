-- Pacífica Hair: independent administrative credential hash and single-use recovery sessions.
-- All reset endpoints require the explicitly configured ADMIN_RECOVERY_EMAIL and a
-- Supabase-verified, confirmed identity matching that email. No user registration here.
CREATE TABLE IF NOT EXISTS ph_admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  iterations INTEGER NOT NULL CHECK (iterations >= 200000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ph_admin_recovery_used (
  token_hash TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ph_admin_recovery_used_at ON ph_admin_recovery_used (used_at);
