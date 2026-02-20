import { scrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const AES_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

export class CryptoService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const hash = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
  }

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const hashBuffer = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
    const storedBuffer = Buffer.from(hash, 'hex');
    if (hashBuffer.length !== storedBuffer.length) return false;
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < hashBuffer.length; i++) {
      diff |= (hashBuffer[i] ?? 0) ^ (storedBuffer[i] ?? 0);
    }
    return diff === 0;
  }

  encryptAES256(plaintext: string, keyHex: string): string {
    const key = Buffer.from(keyHex.padEnd(AES_KEY_LENGTH * 2, '0').slice(0, AES_KEY_LENGTH * 2), 'hex');
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptAES256(ciphertext: string, keyHex: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid ciphertext format');
    const key = Buffer.from(keyHex.padEnd(AES_KEY_LENGTH * 2, '0').slice(0, AES_KEY_LENGTH * 2), 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  generateId(): string {
    return randomBytes(16).toString('hex');
  }
}
