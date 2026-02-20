import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const DATA_DIR = process.env['DATA_DIR'] ?? join(process.cwd(), 'data');
    const dbPath = DATA_DIR === ':memory:' ? ':memory:' : join(DATA_DIR, 'gateway.db');
    if (DATA_DIR !== ':memory:') mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
    runMigrations(_db);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      backup_codes TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      model TEXT NOT NULL,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      temperature REAL NOT NULL DEFAULT 0.0,
      priority INTEGER NOT NULL DEFAULT 5,
      weight INTEGER NOT NULL DEFAULT 10,
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_health (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'offline',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0.0,
      request_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      fingerprint TEXT NOT NULL,
      previous_fingerprint TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

    CREATE TABLE IF NOT EXISTS rate_limit_windows (
      key TEXT NOT NULL,
      window_start TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      encrypted INTEGER NOT NULL DEFAULT 1,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kilo_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_key_encrypted TEXT,
      base_url TEXT NOT NULL DEFAULT 'https://api.kilo.codes',
      model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
      max_tokens_per_request INTEGER NOT NULL DEFAULT 8192,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const version = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  if (!version.v) {
    db.prepare("INSERT INTO schema_version (version) VALUES (1)").run();
  }
}
