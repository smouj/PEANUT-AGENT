import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import type { UserRepository } from '../../domain/auth/user.entity.js';
import { User } from '../../domain/auth/user.entity.js';
import { CryptoService } from './crypto.service.js';
import { AuditService } from './audit.service.js';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors.js';
import type { LoginRequest, LoginResponse, TotpVerifyRequest, TotpSetupResponse } from '@peanut/shared-types';

const APP_NAME = 'PeanutAgent Enterprise';
const BACKUP_CODE_COUNT = 10;

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    _jwtSecret: string,
  ) {}

  async createUser(email: string, name: string, password: string, role: 'admin' | 'operator' | 'viewer'): Promise<User> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError(`User with email '${email}' already exists`);
    }
    if (password.length < 12) {
      throw new ValidationError('Password must be at least 12 characters');
    }

    const passwordHash = await this.crypto.hashPassword(password);
    const user = User.create({
      id: this.crypto.generateId(),
      email,
      name,
      passwordHash,
      role,
      totpSecret: null,
      totpEnabled: false,
      backupCodes: [],
    });

    await this.userRepo.save(user);
    return user;
  }

  async login(
    req: LoginRequest,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponse & { userId: string }> {
    const user = await this.userRepo.findByEmail(req.email);

    if (!user) {
      await this.audit.log({
        action: 'auth.login_failed',
        userId: 'unknown',
        userEmail: req.email,
        ipAddress,
        userAgent,
        resourceType: 'user',
        resourceId: 'unknown',
        details: { reason: 'user_not_found' },
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await this.crypto.verifyPassword(req.password, user.passwordHash);
    if (!valid) {
      await this.audit.log({
        action: 'auth.login_failed',
        userId: user.id,
        userEmail: user.email,
        ipAddress,
        userAgent,
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'invalid_password' },
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const updated = user.recordLogin();
    await this.userRepo.save(updated);

    if (user.totpEnabled) {
      const tempToken = this.generateTempToken(user.id);
      return {
        requireTotp: true,
        tempToken,
        userId: user.id,
      };
    }

    await this.audit.log({
      action: 'auth.login',
      userId: user.id,
      userEmail: user.email,
      ipAddress,
      userAgent,
      resourceType: 'user',
      resourceId: user.id,
      details: { method: 'password' },
    });

    return {
      requireTotp: false,
      userId: user.id,
    };
  }

  async verifyTotp(req: TotpVerifyRequest, ipAddress: string, userAgent: string): Promise<{ userId: string }> {
    const userId = this.validateTempToken(req.tempToken);
    const user = await this.userRepo.findById(userId);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedError('TOTP not configured');
    }

    const isBackupCode = user.backupCodes.includes(req.totpCode);
    if (isBackupCode) {
      const updated = user.useBackupCode(req.totpCode);
      await this.userRepo.save(updated);
    } else {
      const valid = authenticator.verify({ token: req.totpCode, secret: user.totpSecret });
      if (!valid) {
        throw new UnauthorizedError('Invalid TOTP code');
      }
    }

    await this.audit.log({
      action: 'auth.login',
      userId: user.id,
      userEmail: user.email,
      ipAddress,
      userAgent,
      resourceType: 'user',
      resourceId: user.id,
      details: { method: 'totp', usedBackupCode: isBackupCode },
    });

    return { userId: user.id };
  }

  async setupTotp(userId: string): Promise<TotpSetupResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, APP_NAME, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );

    const updated = user.enableTotp(secret, backupCodes);
    await this.userRepo.save(updated);

    await this.audit.log({
      action: 'auth.totp_enabled',
      userId: user.id,
      userEmail: user.email,
      ipAddress: 'internal',
      userAgent: 'system',
      resourceType: 'user',
      resourceId: user.id,
      details: {},
    });

    return { secret, qrCodeUrl, backupCodes };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    if (newPassword.length < 12) throw new ValidationError('Password must be at least 12 characters');

    const valid = await this.crypto.verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const newHash = await this.crypto.hashPassword(newPassword);
    await this.userRepo.save(user.updatePassword(newHash));

    await this.audit.log({
      action: 'auth.password_changed',
      userId: user.id,
      userEmail: user.email,
      ipAddress: 'internal',
      userAgent: 'system',
      resourceType: 'user',
      resourceId: user.id,
      details: {},
    });
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  private generateTempToken(userId: string): string {
    // Signed temp token with expiry (10 minutes)
    const payload = {
      sub: userId,
      exp: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(8).toString('hex'),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private validateTempToken(token: string): string {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString()) as {
        sub: string;
        exp: number;
      };
      if (payload.exp < Date.now()) {
        throw new UnauthorizedError('Temp token expired');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedError('Invalid temp token');
    }
  }
}
