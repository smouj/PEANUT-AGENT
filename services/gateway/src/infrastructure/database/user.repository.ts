import { getDb } from './db.js';
import { User } from '../../domain/auth/user.entity.js';
import type { UserRepository } from '../../domain/auth/user.entity.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  totp_secret: string | null;
  totp_enabled: number;
  backup_codes: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

function rowToUser(row: UserRow): User {
  return User.reconstitute({
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role as 'admin' | 'operator' | 'viewer',
    totpSecret: row.totp_secret,
    totpEnabled: row.totp_enabled === 1,
    backupCodes: JSON.parse(row.backup_codes) as string[],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
  });
}

export class SqliteUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  }

  async save(user: User): Promise<void> {
    const db = getDb();
    const props = user.toObject();
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, totp_secret, totp_enabled, backup_codes, created_at, updated_at, last_login_at)
      VALUES (@id, @email, @name, @passwordHash, @role, @totpSecret, @totpEnabled, @backupCodes, @createdAt, @updatedAt, @lastLoginAt)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        password_hash = excluded.password_hash,
        role = excluded.role,
        totp_secret = excluded.totp_secret,
        totp_enabled = excluded.totp_enabled,
        backup_codes = excluded.backup_codes,
        updated_at = excluded.updated_at,
        last_login_at = excluded.last_login_at
    `).run({
      id: props.id,
      email: props.email.toLowerCase(),
      name: props.name,
      passwordHash: props.passwordHash,
      role: props.role,
      totpSecret: props.totpSecret,
      totpEnabled: props.totpEnabled ? 1 : 0,
      backupCodes: JSON.stringify(props.backupCodes),
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      lastLoginAt: props.lastLoginAt?.toISOString() ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}
