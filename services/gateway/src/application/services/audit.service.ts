import { randomBytes } from 'crypto';
import type { AuditRepository } from '../../domain/audit/audit.entity.js';
import { AuditEntry } from '../../domain/audit/audit.entity.js';
import type { AuditAction, AuditQueryResult } from '@peanut/shared-types';
import type { AuditQueryParams } from '../../domain/audit/audit.entity.js';

export interface LogAuditParams {
  action: AuditAction;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async log(params: LogAuditParams): Promise<void> {
    const previousFingerprint = await this.repo.findLatestFingerprint();
    const entry = AuditEntry.create(
      {
        id: randomBytes(16).toString('hex'),
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details,
        previousFingerprint,
      },
      previousFingerprint,
    );
    await this.repo.save(entry);
  }

  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    const { entries, total } = await this.repo.query(params);
    const pages = Math.ceil(total / params.limit);

    // Verify chain integrity for returned entries
    let integrityValid = true;
    for (const entry of entries) {
      if (!entry.recomputeAndVerify()) {
        integrityValid = false;
        break;
      }
    }

    return {
      entries: entries.map(e => ({
        id: e.id,
        action: e.action,
        userId: e.userId,
        userEmail: e.userEmail,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        details: e.details,
        fingerprint: e.fingerprint,
        previousFingerprint: e.previousFingerprint,
        timestamp: e.timestamp.toISOString(),
      })),
      total,
      page: params.page,
      limit: params.limit,
      pages,
      integrityValid,
    };
  }
}
