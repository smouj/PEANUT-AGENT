import { createHash } from 'crypto';
import type { AuditAction } from '@peanut/shared-types';

export interface AuditEntryProps {
  id: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  fingerprint: string;
  previousFingerprint: string;
  timestamp: Date;
}

export class AuditEntry {
  private constructor(private readonly props: AuditEntryProps) {}

  static create(
    props: Omit<AuditEntryProps, 'fingerprint' | 'timestamp'>,
    previousFingerprint: string,
  ): AuditEntry {
    const timestamp = new Date();
    const fingerprint = AuditEntry.computeFingerprint({
      ...props,
      previousFingerprint,
      timestamp,
    });
    return new AuditEntry({ ...props, fingerprint, previousFingerprint, timestamp });
  }

  static reconstitute(props: AuditEntryProps): AuditEntry {
    return new AuditEntry(props);
  }

  static computeFingerprint(
    data: Omit<AuditEntryProps, 'fingerprint'>,
  ): string {
    const canonical = JSON.stringify({
      id: data.id,
      action: data.action,
      userId: data.userId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      details: data.details,
      previousFingerprint: data.previousFingerprint,
      timestamp: data.timestamp.toISOString(),
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  verifyIntegrity(expectedPreviousFingerprint: string): boolean {
    return this.props.previousFingerprint === expectedPreviousFingerprint;
  }

  recomputeAndVerify(): boolean {
    const recomputed = AuditEntry.computeFingerprint({
      id: this.props.id,
      action: this.props.action,
      userId: this.props.userId,
      userEmail: this.props.userEmail,
      ipAddress: this.props.ipAddress,
      userAgent: this.props.userAgent,
      resourceType: this.props.resourceType,
      resourceId: this.props.resourceId,
      details: this.props.details,
      previousFingerprint: this.props.previousFingerprint,
      timestamp: this.props.timestamp,
    });
    return recomputed === this.props.fingerprint;
  }

  get id(): string { return this.props.id; }
  get action(): AuditAction { return this.props.action; }
  get userId(): string { return this.props.userId; }
  get userEmail(): string { return this.props.userEmail; }
  get ipAddress(): string { return this.props.ipAddress; }
  get userAgent(): string { return this.props.userAgent; }
  get resourceType(): string { return this.props.resourceType; }
  get resourceId(): string { return this.props.resourceId; }
  get details(): Record<string, unknown> { return { ...this.props.details }; }
  get fingerprint(): string { return this.props.fingerprint; }
  get previousFingerprint(): string { return this.props.previousFingerprint; }
  get timestamp(): Date { return this.props.timestamp; }

  toObject(): AuditEntryProps {
    return { ...this.props, details: { ...this.props.details } };
  }
}

export interface AuditRepository {
  findById(id: string): Promise<AuditEntry | null>;
  findLatestFingerprint(): Promise<string>;
  query(params: AuditQueryParams): Promise<{ entries: AuditEntry[]; total: number }>;
  save(entry: AuditEntry): Promise<void>;
}

export interface AuditQueryParams {
  page: number;
  limit: number;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}
