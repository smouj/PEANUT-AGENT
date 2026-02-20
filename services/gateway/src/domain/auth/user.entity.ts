import type { UserRole } from '@peanut/shared-types';
import { ValidationError } from '../errors.js';

export interface UserProps {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  totpSecret: string | null;
  totpEnabled: boolean;
  backupCodes: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: Omit<UserProps, 'createdAt' | 'updatedAt' | 'lastLoginAt'>): User {
    User.validateEmail(props.email);
    return new User({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email address: ${email}`);
    }
  }

  enableTotp(secret: string, backupCodes: string[]): User {
    return new User({
      ...this.props,
      totpSecret: secret,
      totpEnabled: true,
      backupCodes,
      updatedAt: new Date(),
    });
  }

  disableTotp(): User {
    return new User({
      ...this.props,
      totpSecret: null,
      totpEnabled: false,
      backupCodes: [],
      updatedAt: new Date(),
    });
  }

  updatePassword(passwordHash: string): User {
    return new User({
      ...this.props,
      passwordHash,
      updatedAt: new Date(),
    });
  }

  recordLogin(): User {
    return new User({
      ...this.props,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    });
  }

  useBackupCode(code: string): User {
    const remaining = this.props.backupCodes.filter(c => c !== code);
    return new User({ ...this.props, backupCodes: remaining, updatedAt: new Date() });
  }

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get passwordHash(): string { return this.props.passwordHash; }
  get role(): UserRole { return this.props.role; }
  get totpSecret(): string | null { return this.props.totpSecret; }
  get totpEnabled(): boolean { return this.props.totpEnabled; }
  get backupCodes(): string[] { return [...this.props.backupCodes]; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get lastLoginAt(): Date | null { return this.props.lastLoginAt; }

  toObject(): UserProps {
    return { ...this.props, backupCodes: [...this.props.backupCodes] };
  }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
