import { getDb } from './db.js';
import { AuditEntry } from '../../domain/audit/audit.entity.js';
import type { AuditRepository, AuditQueryParams } from '../../domain/audit/audit.entity.js';
import type { AuditAction } from '@peanut/shared-types';

interface AuditRow {
  id: string;
  action: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string;
  resource_type: string;
  resource_id: string;
  details: string;
  fingerprint: string;
  previous_fingerprint: string;
  timestamp: string;
}

function rowToEntry(row: AuditRow): AuditEntry {
  return AuditEntry.reconstitute({
    id: row.id,
    action: row.action as AuditAction,
    userId: row.user_id,
    userEmail: row.user_email,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: JSON.parse(row.details) as Record<string, unknown>,
    fingerprint: row.fingerprint,
    previousFingerprint: row.previous_fingerprint,
    timestamp: new Date(row.timestamp),
  });
}

export class SqliteAuditRepository implements AuditRepository {
  async findById(id: string): Promise<AuditEntry | null> {
    const row = getDb().prepare('SELECT * FROM audit_log WHERE id = ?').get(id) as AuditRow | undefined;
    return row ? rowToEntry(row) : null;
  }

  async findLatestFingerprint(): Promise<string> {
    const row = getDb().prepare(
      'SELECT fingerprint FROM audit_log ORDER BY timestamp DESC LIMIT 1'
    ).get() as { fingerprint: string } | undefined;
    return row?.fingerprint ?? 'GENESIS';
  }

  async query(params: AuditQueryParams): Promise<{ entries: AuditEntry[]; total: number }> {
    const conditions: string[] = [];
    const values: Record<string, unknown> = {};

    if (params.userId) {
      conditions.push('user_id = @userId');
      values['userId'] = params.userId;
    }
    if (params.action) {
      conditions.push('action = @action');
      values['action'] = params.action;
    }
    if (params.resourceType) {
      conditions.push('resource_type = @resourceType');
      values['resourceType'] = params.resourceType;
    }
    if (params.startDate) {
      conditions.push('timestamp >= @startDate');
      values['startDate'] = params.startDate.toISOString();
    }
    if (params.endDate) {
      conditions.push('timestamp <= @endDate');
      values['endDate'] = params.endDate.toISOString();
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (params.page - 1) * params.limit;

    const total = (getDb().prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(values) as { count: number }).count;
    const rows = getDb().prepare(
      `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`
    ).all({ ...values, limit: params.limit, offset }) as AuditRow[];

    return { entries: rows.map(rowToEntry), total };
  }

  async save(entry: AuditEntry): Promise<void> {
    const p = entry.toObject();
    getDb().prepare(`
      INSERT INTO audit_log (id, action, user_id, user_email, ip_address, user_agent, resource_type, resource_id, details, fingerprint, previous_fingerprint, timestamp)
      VALUES (@id, @action, @userId, @userEmail, @ipAddress, @userAgent, @resourceType, @resourceId, @details, @fingerprint, @previousFingerprint, @timestamp)
    `).run({
      id: p.id, action: p.action, userId: p.userId, userEmail: p.userEmail,
      ipAddress: p.ipAddress, userAgent: p.userAgent, resourceType: p.resourceType,
      resourceId: p.resourceId, details: JSON.stringify(p.details),
      fingerprint: p.fingerprint, previousFingerprint: p.previousFingerprint,
      timestamp: p.timestamp.toISOString(),
    });
  }
}
