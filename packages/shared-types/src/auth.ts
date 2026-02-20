export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly totpEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastLoginAt?: string;
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly totpVerified: boolean;
  readonly sessionId: string;
  readonly iat: number;
  readonly exp: number;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly requireTotp: boolean;
  readonly tempToken?: string;
  readonly accessToken?: string;
  readonly expiresAt?: string;
  readonly user?: User;
}

export interface TotpVerifyRequest {
  readonly tempToken: string;
  readonly totpCode: string;
}

export interface TotpSetupResponse {
  readonly secret: string;
  readonly qrCodeUrl: string;
  readonly backupCodes: readonly string[];
}

export interface AuthSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActiveAt: string;
}

export interface ChangePasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}
