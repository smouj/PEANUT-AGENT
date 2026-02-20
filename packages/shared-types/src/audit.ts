export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.totp_enabled'
  | 'auth.password_changed'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.request'
  | 'docker.container_started'
  | 'docker.container_stopped'
  | 'docker.container_deleted'
  | 'docker.image_pulled'
  | 'backup.created'
  | 'backup.restored'
  | 'backup.deleted'
  | 'settings.updated'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted';

export interface AuditEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly userId: string;
  readonly userEmail: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly fingerprint: string;
  readonly previousFingerprint: string;
  readonly timestamp: string;
}

export interface AuditQueryParams {
  readonly page?: number;
  readonly limit?: number;
  readonly userId?: string;
  readonly action?: AuditAction;
  readonly resourceType?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface AuditQueryResult {
  readonly entries: readonly AuditEntry[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
  readonly integrityValid: boolean;
}
